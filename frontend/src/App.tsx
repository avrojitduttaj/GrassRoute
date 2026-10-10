import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
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
  origin: { latitude: number; longitude: number };
  radiusMeters: number;
  count: number;
  places: Place[];
  note?: string;
};
type MissionResponse = {
  mission?: {
    title?: string;
    objective?: string;
    checkpoints?: { instruction: string; durationMinutes: number }[];
  };
  title?: string;
  objective?: string;
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
        setCenter([position.coords.latitude, position.coords.longitude]);
        setLocationReady(true);
        setNotice("Location found. Ready to explore nearby.");
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

  const findPlaces = async () => {
    setLoadingPlaces(true);
    setError("");
    setNotice("");
    try {
      const params = new URLSearchParams({
        latitude: String(center[0]),
        longitude: String(center[1]),
        radiusMeters: String(radius),
      });
      const response = await fetch(`${API}/maps/nearby?${params}`);
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not load nearby places.");
      setPlaces((data as NearbyResponse).places || []);
      setNotice(
        `Found ${(data as NearbyResponse).count} mapped outdoor places. These are place markers, not verified walking routes.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not connect to GrassRoute backend. Is it running on port 4000?",
      );
    } finally {
      setLoadingPlaces(false);
    }
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
                onClick={() => setRadius(n)}
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
            onClick={findPlaces}
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
                    {place.category.replaceAll("_", " ")}
                    <br />
                    {place.distanceFromStartMeters} m straight-line distance
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
              onClick={findPlaces}
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
          {checkpoints.length > 0 && (
            <div className="checkpoint-list">
              {checkpoints.map((cp, i) => (
                <div className="checkpoint" key={`${i}-${cp.instruction}`}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    {cp.instruction}
                    <small>{cp.durationMinutes} min</small>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="preview-disclaimer">
            Preview only — this version does not start background GPS tracking
            or verify route safety. We’ll add those after pedestrian routing is
            connected.
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
