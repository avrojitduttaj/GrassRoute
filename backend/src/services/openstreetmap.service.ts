export type NearbyPlaceInput = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type OutdoorPlace = {
  id: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceFromStartMeters: number;
  source: 'OpenStreetMap';
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function findNearbyOutdoorPlaces(input: NearbyPlaceInput): Promise<OutdoorPlace[]> {
  const { latitude, longitude, radiusMeters } = input;
  // Overpass searches mapped public green spaces and recreational places around the GPS point.
  const query = `[out:json][timeout:20];(\n` +
    `  way(around:${radiusMeters},${latitude},${longitude})[leisure~"^(park|garden|nature_reserve|playground)$"];\n` +
    `  relation(around:${radiusMeters},${latitude},${longitude})[leisure~"^(park|garden|nature_reserve)$"];\n` +
    `  node(around:${radiusMeters},${latitude},${longitude})[leisure~"^(park|garden|nature_reserve|playground)$"];\n` +
    `);out center tags;`;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(25_000)
  });

  if (!response.ok) throw new Error(`Overpass responded with ${response.status}`);
  const payload = await response.json() as { elements?: OverpassElement[] };
  const elements = payload.elements ?? [];

  const results = elements.flatMap((element): OutdoorPlace[] => {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat === undefined || lon === undefined) return [];

    const distance = distanceMeters(latitude, longitude, lat, lon);
    if (distance > radiusMeters) return [];

    const tags = element.tags ?? {};
    const category = tags.leisure ?? 'outdoor';
    return [{
      id: element.id,
      name: tags.name ?? `Unnamed ${category.replaceAll('_', ' ')}`,
      category,
      latitude: lat,
      longitude: lon,
      distanceFromStartMeters: Math.round(distance),
      source: 'OpenStreetMap'
    }];
  });

  return results
    .sort((a, b) => a.distanceFromStartMeters - b.distanceFromStartMeters)
    .slice(0, 40);
}
