import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  ArrowDownRight,
  ArrowUpRight,
  Compass,
  LocateFixed,
  MapPin,
  Navigation,
  Play,
  ShieldCheck,
  Sparkles,
  Trees,
  Timer,
  Footprints,
  Leaf,
  LoaderCircle,
} from "lucide-react";

type Place = {
  id: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceFromStartMeters: number;
  source: string;
};

type NearbyResponse = {
  origin: {
    latitude: number;
    longitude: number;
  };
  radiusMeters: number;
  count: number;
  places: Place[];
  note?: string;
};

type WalkingRouteResponse = {
  start: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  roundTrip: boolean;
  distanceMeters: number;
  durationSeconds: number;
  geometry: Array<[number, number]>;
  instructions: string[];
  note?: string;
};

type ActiveWalkingRoute = WalkingRouteResponse & {
  destinationName: string;
};

type MissionResponse = {
  mission?: {
    title?: string;
    objective?: string;
    checkpoints?: {
      instruction: string;
      durationMinutes: number;
    }[];
  };
  title?: string;
  objective?: string;
  instructions?: string[];
  durationMinutes?: number;
  radiusMeters?: number;
  message?: string;
  note?: string;
};

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";
const DEFAULT_CENTER: [number, number] = [19.076, 72.8777]; // Mumbai fallback only; ask permission for real location.

const markerIcon = L.divIcon({
  className: "place-marker-wrap",
  html: '<div class="place-marker"><span>✦</span></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const userIcon = L.divIcon({
  className: "user-marker-wrap",
  html: '<div class="user-marker"><div></div></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15, { duration: 1.1 });
  }, [center, map]);
  return null;
}

function FitRouteBounds({ positions }: { positions: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    const bounds = L.latLngBounds(
      positions.map(([latitude, longitude]) => L.latLng(latitude, longitude)),
    );
    map.fitBounds(bounds.pad(0.12), { maxZoom: 16, animate: true });
  }, [map, positions]);
  return null;
}

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
}

function App() {
  const [duration, setDuration] = useState(45);
  const [radius, setRadius] = useState(1500);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [locationReady, setLocationReady] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loadingMission, setLoadingMission] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mission, setMission] = useState<MissionResponse | null>(null);
  const [walkingRoute, setWalkingRoute] = useState<ActiveWalkingRoute | null>(
    null,
  );
  const [loadingRoute, setLoadingRoute] = useState(false);
  const mapCenter = useMemo<[number, number]>(() => center, [center]);
  const locateMe = () => {
    setError("");
    setNotice("");
    if (!navigator.geolocation) {
      setError("Your browser does not support location access.");
      return;
    }
    setNotice("Waiting for location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
  const nextCenter: [number, number] = [
    position.coords.latitude,
    position.coords.longitude,
  ];

  setCenter(nextCenter);
  setLocationReady(true);
  setNotice("Location found. Searching nearby…");

  void findPlaces(nextCenter, radius);
},
      (geoError) => {
        setNotice("");
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission was denied. You can still explore the demo map, or enable location in your browser settings."
            : "Could not get your location. Check GPS/location services and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };
  const findPlaces = async (
    searchCenter: [number, number] = center,
    searchRadius: number = radius,
  ) => {
    setLoadingPlaces(true);
    setError("");
    setNotice("");

    try {
      const params = new URLSearchParams({
        latitude: String(searchCenter[0]),
        longitude: String(searchCenter[1]),
        radiusMeters: String(searchRadius),
      });

      const response = await fetch(`${API}/maps/nearby?${params}`);

      let data: unknown;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      const payload =
        typeof data === "object" && data !== null
          ? (data as {
              error?: unknown;
              details?: unknown;
              count?: unknown;
              places?: unknown;
            })
          : {};

      if (!response.ok) {
        const message =
          typeof payload.error === "string"
            ? payload.error
            : `Place search failed (HTTP ${response.status}).`;

        const details =
          typeof payload.details === "string" ? payload.details : "";

        throw new Error(details ? `${message} Details: ${details}` : message);
      }

      const result = data as NearbyResponse;

      const nextPlaces = Array.isArray(result.places) ? result.places : [];

      setPlaces(nextPlaces);

      setNotice(
        nextPlaces.length > 0
          ? `Found ${nextPlaces.length} mapped outdoor places. Check access before visiting.`
          : "No mapped outdoor places were returned for this area. Try a larger radius.",
      );
    } catch (error) {
      setPlaces([]);

      const message =
        error instanceof Error ? error.message : "Unknown request error";

      setError(
        message === "Failed to fetch"
          ? `Cannot reach the GrassRoute API at ${API}. Check that the backend is running on port 4000.`
          : message,
      );
    } finally {
      setLoadingPlaces(false);
    }
  };
  const findWalkingRoute = async (place: Place) => {
    setLoadingRoute(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API}/maps/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { latitude: center[0], longitude: center[1] },
          destination: {
            latitude: place.latitude,
            longitude: place.longitude,
          },
        }),
        signal: AbortSignal.timeout(25000),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Could not calculate a walking route.";
        throw new Error(message);
      }
      const result = data as WalkingRouteResponse;
      if (!Array.isArray(result.geometry) || result.geometry.length < 2) {
        throw new Error(
          "The routing service returned no usable route geometry.",
        );
      }
      setWalkingRoute({ ...result, destinationName: place.name });
      setNotice(
        `Walking route to ${place.name} is ready. The distance and time include the return journey.`,
      );
    } catch (e) {
      setWalkingRoute(null);
      setError(
        e instanceof Error
          ? `${e.message} Check your connection and try again.`
          : "Could not calculate a walking route. Is the backend running on port 4000?",
      );
    } finally {
      setLoadingRoute(false);
    }
  };
  const speakWalkingDirections = () => {
    if (!walkingRoute) return;
    if (!("speechSynthesis" in window)) {
      setError("Voice directions are not supported by this browser.");
      return;
    }
    const directions = walkingRoute.instructions.length
      ? walkingRoute.instructions.join(". ")
      : `Walk to ${walkingRoute.destinationName} and return to your starting point. Follow the route shown on the map.`;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `Walking directions to ${walkingRoute.destinationName}, and back. ${directions}`,
    );
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  };
  const startMission = async () => {
    setLoadingMission(true);
    setError("");
    setNotice("");
    setMission(null);
    try {
      const response = await fetch(`${API}/missions/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          available_minutes: duration,
          radius_meters: radius,
          nearby_places: places.slice(0, 10).map((place) => place.name),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not create mission preview.");
      }
      const generatedMission = data as MissionResponse;
      setMission(generatedMission);
      const title =
        generatedMission.mission?.title ||
        generatedMission.title ||
        "Your outdoor mission";
      const objective =
        generatedMission.mission?.objective ||
        generatedMission.objective ||
        generatedMission.message ||
        generatedMission.note ||
        "Explore your surroundings at a comfortable pace.";
      speakMission(title, objective);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not connect to GrassRoute backend. Is it running on port 4000?",
      );
    } finally {
      setLoadingMission(false);
    }
  };
  useEffect(() => {
    void findPlaces(); /* initial sample-area map; user can switch to GPS */
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const missionTitle =
    mission?.mission?.title || mission?.title || "Your first outdoor mission";
  const missionObjective =
    mission?.mission?.objective ||
    mission?.objective ||
    mission?.message ||
    mission?.note ||
    "The backend has returned a preview. Next we will connect real places, pedestrian routes and the AI mission planner.";
  const checkpoints = mission?.mission?.checkpoints || [];
  const missionInstructions =
    mission?.instructions ||
    checkpoints.map((checkpoint) => checkpoint.instruction);
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="GrassRoute home">
          <span className="brand-mark">
            <Leaf size={19} />
          </span>
          <span>
            grass<span className="brand-light">route</span>
            <small>GO OUTSIDE, ON PURPOSE.</small>
          </span>
        </a>
        <div className="topbar-right">
          <span className="open-pill">
            <span /> OPEN SOURCE PROJECT
          </span>
          <button className="location-button" onClick={locateMe}>
            <LocateFixed size={16} />{" "}
            {locationReady ? "Location found" : "Use my location"}
          </button>
        </div>
      </header>
      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={14} /> YOUR NEXT LITTLE ADVENTURE
          </div>
          <h1>
            A little less <span>scrolling.</span>
            <br />A lot more <em>living.</em>
          </h1>
          <p>
            Tell us how much time you have. We’ll find a little adventure around
            you. Then put your phone away and go live it.
          </p>
          <div className="hero-points">
            <span>
              <ShieldCheck size={15} /> No photos
            </span>
            <span>
              <Footprints size={15} /> No check-ins
            </span>
            <span>
              <Leaf size={15} /> Just outside
            </span>
          </div>
        </div>
        <div className="hero-stamp">
          <Trees size={25} />
          <span>
            THE WORLD
            <br />
            IS WAITING
          </span>
          <ArrowDownRight size={18} />
        </div>
      </section>
      <section className="workspace">
        <aside className="planner-panel">
          <div className="section-kicker">01 / MAKE IT YOURS</div>
          <h2>
            Your time.
            <br />
            Your little escape.
          </h2>
          <p className="muted">Pick two things. We’ll take it from there.</p>
          <div className="field-heading">
            <span>
              <Timer size={17} /> How much time?
            </span>
            <strong>
              {duration} <small>MIN</small>
            </strong>
          </div>
          <div className="choice-grid time-grid">
            {[15, 30, 45, 60].map((n) => (
              <button
                key={n}
                className={`choice ${duration === n ? "selected" : ""}`}
                onClick={() => setDuration(n)}
              >
                {n}
                <small>min</small>
              </button>
            ))}
          </div>
          <div className="field-heading radius-heading">
            <span>
              <Compass size={17} /> How far to roam?
            </span>
            <strong>
              {radius >= 1000
                ? `${(radius / 1000).toLocaleString()} km`
                : `${radius} m`}
            </strong>
          </div>
          <div className="choice-grid radius-grid">
            {[500, 1000, 1500, 2500].map((n) => (
              <button
                key={n}
                className={`choice radius-choice ${radius === n ? "selected" : ""}`}
                onClick={() => {
                  setRadius(n);
                  setWalkingRoute(null);
                }}
              >
                {n >= 1000 ? `${n / 1000} km` : `${n} m`}
              </button>
            ))}
          </div>
          <div className="radius-note">
            <MapPin size={14} /> Straight-line search radius; walking distance
            may be longer.
          </div>
          <button
            className="find-button"
            onClick={() => {
              void findPlaces();
            }}
            disabled={loadingPlaces}
          >
            {loadingPlaces ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <MapPin size={18} />
            )}
            {loadingPlaces ? "Finding nearby places…" : "EXPLORE MY AREA"}
            <ArrowUpRight size={17} />
          </button>
          <button
            className="start-button"
            onClick={startMission}
            disabled={loadingMission}
          >
            {loadingMission ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Play size={17} fill="currentColor" />
            )}
            {loadingMission ? "Building your mission…" : "START MISSION"}
          </button>
          <p className="tiny-note">
            Your location is requested only when you choose to share it. Sample
            map starts around Mumbai.
          </p>
          {notice && (
            <div className="notice">
              <ShieldCheck size={16} /> <span>{notice}</span>
            </div>
          )}
          {error && <div className="error-message">{error}</div>}
        </aside>
        <section
          className="map-panel"
          aria-label="Map of nearby outdoor places"
        >
          <div className="map-topline">
            <div>
              <span className="live-dot" />{" "}
              <strong>YOUR OUTDOOR NEIGHBOURHOOD</strong>
              <small>
                {locationReady ? "USING YOUR LOCATION" : "SAMPLE AREA · MUMBAI"}
              </small>
            </div>
            <span className="map-count">
              <Trees size={15} /> {places.length} places
            </span>
          </div>
          <div className="map-canvas">
            <MapContainer
              center={mapCenter}
              zoom={14}
              scrollWheelZoom
              className="leaflet-map"
            >
              <Recenter center={mapCenter} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Circle
                center={mapCenter}
                radius={radius}
                pathOptions={{
                  color: "#54845b",
                  weight: 1.5,
                  dashArray: "6 7",
                  fillColor: "#92b68b",
                  fillOpacity: 0.12,
                }}
              />
              {walkingRoute && (
                <>
                  <Polyline
                    positions={walkingRoute.geometry}
                    pathOptions={{
                      color: "#d8754d",
                      weight: 5,
                      opacity: 0.92,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                  <FitRouteBounds positions={walkingRoute.geometry} />
                </>
              )}
              <Marker position={mapCenter} icon={userIcon}>
                <Popup>
                  {locationReady
                    ? "Your current location"
                    : "Sample starting point — use “Use my location” for GPS."}
                </Popup>
              </Marker>
              {places.map((place) => (
                <Marker
                  key={`${place.id}-${place.latitude}-${place.longitude}`}
                  position={[place.latitude, place.longitude]}
                  icon={markerIcon}
                >
                  <Popup>
                    <strong>{place.name}</strong>
                    <br />
                    {place.category.replace(/_/g, " ")}
                    <br />
                    {place.distanceFromStartMeters} m straight-line distance
                    <br />
                    <button
                      type="button"
                      className="route-place-button"
                      disabled={loadingRoute}
                      onClick={() => void findWalkingRoute(place)}
                    >
                      {loadingRoute
                        ? "Calculating route…"
                        : "Plan walk there & back"}
                    </button>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            <div className="map-legend">
              <span className="legend-home" /> Start{" "}
              <span className="legend-place">✦</span> Outdoor place
            </div>
            <button
              className="map-reload"
              onClick={locateMe}
              title="Use current location"
            >
              <LocateFixed size={17} />
            </button>
          </div>
          {walkingRoute && (
            <div className="route-summary" role="status">
              <div className="route-summary-top">
                <div>
                  <strong>
                    Walking route · {walkingRoute.destinationName}
                  </strong>
                  <p>There and back · estimates from pedestrian routing data</p>
                </div>
                <button
                  type="button"
                  className="route-clear-button"
                  onClick={() => {
                    if ("speechSynthesis" in window) {
                      window.speechSynthesis.cancel();
                    }
                    setWalkingRoute(null);
                  }}
                >
                  Clear route
                </button>
              </div>
              <div className="route-stats">
                <span>
                  <Footprints size={15} />{" "}
                  {formatDistance(walkingRoute.distanceMeters)} total
                </span>
                <span>
                  <Timer size={15} /> About{" "}
                  {formatDuration(walkingRoute.durationSeconds)} walking
                </span>
                <button
                  type="button"
                  className="route-voice-button"
                  onClick={speakWalkingDirections}
                >
                  <Navigation size={15} /> Hear directions
                </button>
              </div>
              {walkingRoute.instructions.length > 0 && (
                <details className="route-directions">
                  <summary>
                    View turn-by-turn directions (
                    {walkingRoute.instructions.length} steps)
                  </summary>
                  <ol>
                    {walkingRoute.instructions.map((instruction, index) => (
                      <li key={`${index}-${instruction}`}>{instruction}</li>
                    ))}
                  </ol>
                </details>
              )}
              <p className="route-disclaimer">
                {walkingRoute.note ||
                  "Estimates only. Check local access and surroundings before setting out."}
              </p>
            </div>
          )}
          <div className="map-footer">
            <div className="map-footer-icon">
              <Trees size={20} />
            </div>
            <div>
              <strong>Little places, right around you.</strong>
              <p>
                Map data from OpenStreetMap. Places and access must be checked
                before a mission uses them.
              </p>
            </div>
            <button
              onClick={() => {
                void findPlaces();
              }}
              disabled={loadingPlaces}
              aria-label="Refresh nearby places"
            >
              <ArrowUpRight size={18} />
            </button>
          </div>
        </section>
      </section>
      {mission && (
        <section className="mission-result">
          <div className="section-kicker">02 / YOUR MISSION PREVIEW</div>
          <div className="mission-result-head">
            <div>
              <h2>{missionTitle}</h2>
              <p>{missionObjective}</p>
            </div>
            <div className="mission-badge">
              <Leaf size={22} />
            </div>
          </div>
          <div className="mission-meta">
            <span>
              <Timer size={15} /> {duration} minutes
            </span>
            <span>
              <Compass size={15} />{" "}
              {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} radius
            </span>
            <span>
              <MapPin size={15} /> {places.length} mapped places nearby
            </span>
          </div>
          {missionInstructions.length > 0 && (
            <div className="checkpoint-list" aria-label="Mission instructions">
              {missionInstructions.map((instruction, i) => {
                const checkpoint = checkpoints[i];
                return (
                  <div className="checkpoint" key={`${i}-${instruction}`}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      {instruction}
                      {checkpoint && (
                        <small>{checkpoint.durationMinutes} min</small>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="preview-disclaimer">
            Preview only — routes are estimates from mapped pedestrian data.
            GrassRoute does not verify access, lighting, closures, or route
            safety.
          </div>
        </section>
      )}
      <footer className="footer">
        <span>GRASSROUTE © 2026</span>
        <span>
          BUILT TO HELP YOU LOG OFF AND LOOK UP <Leaf size={13} />
        </span>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          MAP DATA ATTRIBUTION ↗
        </a>
      </footer>
    </main>
  );
}

function speakMission(title: string, objective: string) {
  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis is not supported in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const text = `${title}. ${objective} Remember, stay aware of your surroundings and put your phone away when you're ready to begin.`;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}
export default App;
