import { Router } from "express";
import { z } from "zod";

const router = Router();

const nearbyQuerySchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(100).max(10000),
});

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

const REQUEST_TIMEOUT_MS = 15000;

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  // Protect against floating-point rounding outside [0, 1].
  const clampedA = Math.max(0, Math.min(1, a));

  return Math.round(
    earthRadius *
      2 *
      Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA)),
  );
}

function isOverpassResponse(value: unknown): value is OverpassResponse {
  if (typeof value !== "object" || value === null) return false;

  const elements = (value as { elements?: unknown }).elements;

  return (
    Array.isArray(elements) &&
    elements.every(
      (element) =>
        typeof element === "object" &&
        element !== null &&
        typeof element.type === "string" &&
        typeof element.id === "number",
    )
  );
}

async function fetchNearbyPlaces(
  query: string,
): Promise<OverpassResponse> {
  let lastError = "No Overpass endpoint responded.";

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "GrassRoute/0.1.0",
        },
        body: query,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const details = (await response.text()).slice(0, 300);

        lastError = `${endpoint} returned HTTP ${response.status}: ${
          details || response.statusText
        }`;

        console.warn("Overpass endpoint failed:", {
          endpoint,
          status: response.status,
        });

        // Invalid queries and other client errors won't be fixed
        // by switching servers.
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 408 &&
          response.status !== 429
        ) {
          throw Object.assign(new Error(lastError), {
            statusCode: response.status,
          });
        }

        continue;
      }

      const data: unknown = await response.json();

      if (!isOverpassResponse(data)) {
        lastError = `${endpoint} returned an invalid response.`;
        console.warn(lastError);
        continue;
      }

      return data;
    } catch (error) {
      // Do not retry permanent client errors such as an invalid query.
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error
      ) {
        throw error;
      }

      lastError =
        error instanceof Error ? error.message : String(error);

      console.warn("Overpass request failed:", {
        endpoint,
        error: lastError,
      });
    }
  }

  throw new Error(
    `All Overpass endpoints failed. Last error: ${lastError}`,
  );
}

router.get("/nearby", async (req, res) => {
  const parsed = nearbyQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid location or search radius",
      details: parsed.error.flatten(),
    });
  }

  const { latitude, longitude, radiusMeters } = parsed.data;

  const query = `
    [out:json][timeout:12];
    (
      node["leisure"~"^(park|garden|nature_reserve)$"](around:${radiusMeters},${latitude},${longitude});
      way["leisure"~"^(park|garden|nature_reserve)$"](around:${radiusMeters},${latitude},${longitude});
      relation["leisure"~"^(park|garden|nature_reserve)$"](around:${radiusMeters},${latitude},${longitude});

      node["natural"~"^(wood|grassland)$"](around:${radiusMeters},${latitude},${longitude});
      way["natural"~"^(wood|grassland)$"](around:${radiusMeters},${latitude},${longitude});
      relation["natural"~"^(wood|grassland)$"](around:${radiusMeters},${latitude},${longitude});

      node["landuse"="grass"](around:${radiusMeters},${latitude},${longitude});
      way["landuse"="grass"](around:${radiusMeters},${latitude},${longitude});
      relation["landuse"="grass"](around:${radiusMeters},${latitude},${longitude});
    );
    out center tags;
  `;

  try {
    const data = await fetchNearbyPlaces(query);
    const seen = new Set<string>();

    const places = data.elements
      .map((element) => {
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;

        if (
          lat === undefined ||
          lon === undefined ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lon)
        ) {
          return null;
        }

        const tags = element.tags ?? {};

        const name =
          tags.name ??
          tags["name:en"] ??
          tags.leisure ??
          tags.natural ??
          "Unnamed green space";

        const category =
          tags.leisure ??
          tags.natural ??
          tags.landuse ??
          "green_space";

        const id = `${element.type}-${element.id}`;

        if (seen.has(id)) return null;
        seen.add(id);

        return {
          id: element.id,
          name,
          category,
          latitude: lat,
          longitude: lon,
          distanceFromStartMeters: distanceInMeters(
            latitude,
            longitude,
            lat,
            lon,
          ),
          source: "OpenStreetMap" as const,
          osmType: element.type,
        };
      })
      .filter(
        (place): place is NonNullable<typeof place> =>
          place !== null &&
          place.distanceFromStartMeters <= radiusMeters,
      )
      .sort(
        (a, b) =>
          a.distanceFromStartMeters - b.distanceFromStartMeters,
      );

    return res.json({
      origin: { latitude, longitude },
      radiusMeters,
      count: places.length,
      places,
      note:
        "Mapped green spaces only; access and walking-route safety are not verified.",
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;

    console.error("OpenStreetMap nearby search failed:", error);

    return res.status(statusCode === 400 ? 502 : 502).json({
      error: "OpenStreetMap place search is temporarily unavailable.",
      details:
        error instanceof Error
          ? error.message
          : "All place-search services failed.",
    });
  }
});

export default router;
