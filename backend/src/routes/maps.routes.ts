import { Router } from "express";
import { z } from "zod";
import { getWalkingRoute } from "../services/maps/routing.service.js";

const router = Router();


const nearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(100).max(10000),
});

function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
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

  return Math.round(
    earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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
    [out:json][timeout:20];
    (
      node["leisure"~"park|garden|nature_reserve"](around:${radiusMeters},${latitude},${longitude});
      way["leisure"~"park|garden|nature_reserve"](around:${radiusMeters},${latitude},${longitude});
      relation["leisure"~"park|garden|nature_reserve"](around:${radiusMeters},${latitude},${longitude});
      node["natural"~"wood|grassland"](around:${radiusMeters},${latitude},${longitude});
      way["natural"~"wood|grassland"](around:${radiusMeters},${latitude},${longitude});
      node["landuse"="grass"](around:${radiusMeters},${latitude},${longitude});
      way["landuse"="grass"](around:${radiusMeters},${latitude},${longitude});
    );
    out center tags;
  `;

  try {
    const response = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        
headers: {
  "Content-Type": "text/plain",
  "Accept": "application/json",
  "User-Agent": "GrassRoute/0.1.0 (open-source outdoor exploration app)",
},
body: query,
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!response.ok) {
      const responseBody = await response.text();

      console.error("Overpass API error:", {
        status: response.status,
        statusText: response.statusText,
        body: responseBody.slice(0, 500),
      });

      return res.status(502).json({
        error: "OpenStreetMap place search is temporarily unavailable.",
        upstreamStatus: response.status,
        details: responseBody.slice(0, 500) || response.statusText,
      });
    }

    const data = (await response.json()) as {
      elements: {
        type: string;
        id: number;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }[];
    };

    const seen = new Set<string>();

    const places = data.elements
      .map((element) => {
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;

        if (lat === undefined || lon === undefined) return null;

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
            lon
          ),
          source: "OpenStreetMap",
        };
      })
      .filter(
        (place): place is NonNullable<typeof place> =>
          place !== null &&
          place.distanceFromStartMeters <= radiusMeters
      )
      .sort(
        (a, b) =>
          a.distanceFromStartMeters - b.distanceFromStartMeters
      );

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
    details: error instanceof Error ? error.message : String(error),
  });
}
});

export default router;