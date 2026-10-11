export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface WalkingRoute {
  /** Total distance for the outbound and return legs, in metres. */
  distanceMeters: number;
  /** Estimated total walking time for both legs, in seconds. */
  durationSeconds: number;
  /** Leaflet-ready [latitude, longitude] positions. */
  geometry: [number, number][];
  /** Turn instructions from Valhalla, when supplied by the routing graph. */
  instructions: string[];
}

type ValhallaManeuver = {
  instruction?: unknown;
};

type ValhallaLeg = {
  shape?: unknown;
  summary?: { length?: number; time?: number };
  maneuvers?: ValhallaManeuver[];
};

type ValhallaTrip = {
  summary?: { length?: number; time?: number };
  legs?: ValhallaLeg[];
};

type ValhallaResponse = {
  trip?: ValhallaTrip;
  error?: string;
  status?: number;
};

const ROUTING_URL =
  process.env.VALHALLA_ROUTING_URL?.trim() ||
  'https://valhalla1.openstreetmap.de/route';
const ROUTING_TIMEOUT_MS = 20_000;

/** Decode Valhalla's default six-decimal-precision encoded polyline. */
function decodePolyline6(encoded: string): [number, number][] {
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const coordinates: [number, number][] = [];

  const readDelta = (): number => {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      if (index >= encoded.length) {
        throw new Error('The routing service returned a truncated route shape.');
      }

      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) {
        throw new Error('The routing service returned an invalid route shape.');
      }

      result |= (byte & 0x1f) << shift;
      shift += 5;
      if (shift > 30) {
        throw new Error('The routing service returned an invalid route shape.');
      }
    } while (byte >= 0x20);

    return (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    latitude += readDelta();
    longitude += readDelta();
    coordinates.push([latitude / 1_000_000, longitude / 1_000_000]);
  }

  return coordinates;
}

function getGeoJsonCoordinates(shape: unknown): [number, number][] | null {
  if (typeof shape !== 'object' || shape === null || !('coordinates' in shape)) {
    return null;
  }

  const coordinates = (shape as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) return null;

  const output: [number, number][] = [];
  for (const point of coordinates) {
    if (
      !Array.isArray(point) ||
      point.length < 2 ||
      typeof point[0] !== 'number' ||
      typeof point[1] !== 'number' ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1])
    ) {
      return null;
    }
    // GeoJSON coordinate order is [longitude, latitude]; Leaflet expects [latitude, longitude].
    output.push([point[1], point[0]]);
  }
  return output;
}

function appendGeometry(
  target: [number, number][],
  segment: [number, number][],
): void {
  for (const point of segment) {
    const previous = target[target.length - 1];
    if (previous && previous[0] === point[0] && previous[1] === point[1]) continue;
    target.push(point);
  }
}

export async function getWalkingRoute(
  start: Coordinates,
  destination: Coordinates,
): Promise<WalkingRoute> {
  const response = await fetch(ROUTING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      // The third location intentionally routes back to the start.
      locations: [
        { lat: start.latitude, lon: start.longitude, type: 'break' },
        { lat: destination.latitude, lon: destination.longitude, type: 'break' },
        { lat: start.latitude, lon: start.longitude, type: 'break' },
      ],
      costing: 'pedestrian',
      units: 'kilometers',
      language: 'en-US',
    }),
    signal: AbortSignal.timeout(ROUTING_TIMEOUT_MS),
  });

  const responseText = await response.text();
  let payload: ValhallaResponse;
  try {
    payload = JSON.parse(responseText) as ValhallaResponse;
  } catch {
    throw new Error(`Routing service returned invalid JSON (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const reason = typeof payload.error === 'string' ? payload.error : response.statusText;
    throw new Error(`Routing service failed (HTTP ${response.status}): ${reason}`);
  }

  const trip = payload.trip;
  const legs = trip?.legs;
  if (!trip || !Array.isArray(legs) || legs.length === 0) {
    throw new Error(payload.error || 'No pedestrian route could be found for this place.');
  }

  const geometry: [number, number][] = [];
  const instructions: string[] = [];

  for (const leg of legs) {
    let segment: [number, number][] | null = null;
    if (typeof leg.shape === 'string') {
      segment = decodePolyline6(leg.shape);
    } else {
      segment = getGeoJsonCoordinates(leg.shape);
    }

    if (!segment || segment.length === 0) {
      throw new Error('The routing service did not return usable walking-route geometry.');
    }
    appendGeometry(geometry, segment);

    for (const maneuver of leg.maneuvers ?? []) {
      if (typeof maneuver.instruction === 'string' && maneuver.instruction.trim()) {
        instructions.push(maneuver.instruction.trim());
      }
    }
  }

  if (geometry.length < 2) {
    throw new Error('The routing service returned an incomplete walking route.');
  }

  const distanceKm = trip.summary?.length ?? legs.reduce(
    (total, leg) => total + (leg.summary?.length ?? 0),
    0,
  );
  const durationSeconds = trip.summary?.time ?? legs.reduce(
    (total, leg) => total + (leg.summary?.time ?? 0),
    0,
  );

  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('The routing service returned invalid distance or duration estimates.');
  }

  return {
    distanceMeters: Math.round(distanceKm * 1000),
    durationSeconds: Math.round(durationSeconds),
    geometry,
    instructions,
  };
}
