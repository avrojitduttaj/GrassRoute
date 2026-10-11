import { Router } from "express";
import { z } from "zod";
import { getWalkingRoute } from "../services/maps/routing.service.js";

const router = Router();

const nearbyQuerySchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(100).max(10000),
});

const coordinatesSchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
});

const walkingRouteRequestSchema = z.object({
  start: coordinatesSchema,
  destination: coordinatesSchema,
});

const OVERPASS_ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const REQUEST_TIMEOUT_MS = 20_000;
const QUERY_CACHE_TTL_MS = 60_000;

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const queryCache = new Map<
  string,
  {
    expiresAt: number;
    data: OverpassResponse;
  }
>();

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
  const clampedA = Math.max(0, Math.min(1, a));

  return Math.round(
    earthRadius * 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA)),
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

async function fetchNearbyPlaces(query: string): Promise<OverpassResponse> {
  const cached = queryCache.get(query);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (cached) {
    queryCache.delete(query);
  }
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
        lastError = `${endpoint} returned HTTP ${response.status}: ${details || response.statusText}`;
        console.warn("Overpass endpoint failed:", {
          endpoint,
          status: response.status,
        });

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

      queryCache.set(query, {
        expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
        data,
      });

      return data;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error
      ) {
        throw error;
      }
      lastError = error instanceof Error ? error.message : String(error);
      console.warn("Overpass request failed:", { endpoint, error: lastError });
    }
  }

  throw new Error(`All Overpass endpoints failed. Last error: ${lastError}`);
}

/**
 * POST /api/v1/maps/route
 * Calculates a pedestrian route from start to destination and back to start.
 * This endpoint is defined on the existing maps router, so app.ts needs no
 * additional router registration.
 */
router.post("/route", async (req, res) => {
  const parsed = walkingRouteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid walking-route request",
      details: parsed.error.flatten(),
    });
  }

  const { start, destination } = parsed.data;
  if (
    start.latitude === destination.latitude &&
    start.longitude === destination.longitude
  ) {
    return res.status(400).json({
      error: "Choose a destination different from your starting point.",
    });
  }

  try {
    const route = await getWalkingRoute(start, destination);
    return res.json({
      start,
      destination,
      roundTrip: true,
      ...route,
      note: "Walking distance and time are estimates. Check access and surroundings; mapped data does not guarantee a place is public, open, or safe.",
    });
  } catch (error) {
    console.error("Walking route calculation failed:", error);
    return res.status(502).json({
      error: "Could not calculate a pedestrian route.",
      details:
        error instanceof Error ? error.message : "The routing service failed.",
    });
  }
});

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
          tags.leisure ?? tags.natural ?? tags.landuse ?? "green_space";
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
          place !== null && place.distanceFromStartMeters <= radiusMeters,
      )
      .sort((a, b) => a.distanceFromStartMeters - b.distanceFromStartMeters);

    return res.json({
      origin: { latitude, longitude },
      radiusMeters,
      count: places.length,
      places,
      note: "Mapped green spaces only; access and walking-route safety are not verified.",
    });
  } catch (error) {
    console.error("OpenStreetMap nearby search failed:", error);
    return res.status(502).json({
      error: "OpenStreetMap place search is temporarily unavailable.",
      details:
        error instanceof Error
          ? error.message
          : "All place-search services failed.",
    });
  }
});

export default router;
