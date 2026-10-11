# GrassRoute 🌱

**Choose your time. Find a place. Take a little mission. Put your phone away.**

GrassRoute is an open-source-minded outdoor exploration prototype that helps people spend less time on their screens and more time in the world around them. It combines mapped outdoor places, pedestrian route planning, and AI-generated mission briefings designed to be heard and remembered before a walk.

> **Project status:** Early-stage prototype. Features depend on public map/routing services and a locally running Gemma model. Routes, mapped places, opening hours, accessibility, and safety are not independently verified by GrassRoute.

## What it does

- **Discover nearby outdoor places:** queries OpenStreetMap data through public Overpass instances.
- **Plan a pedestrian round trip:** asks a Valhalla routing service for a walking route to a selected destination and back to the starting point.
- **Create an outdoor mission:** calls a local FastAPI service that uses the Gemma 3 4B model through Ollama. If AI generation is unavailable, the backend can return a deterministic fallback mission.
- **Offer voice-friendly briefings:** the frontend uses browser speech synthesis for spoken text and directions.
- **Let the user choose:** the user explicitly opts in to browser geolocation; the app has sample coordinates for its initial demo view.

The aim is for the screen to be the shortest part of the experience: prepare the mission, understand the route, then focus on the outdoors.

## Current capabilities and limitations

| Area | Current behavior | Limitations |
|---|---|---|
| Map | React-Leaflet map with OpenStreetMap tiles and outdoor-place markers | Tile and place data may be incomplete or rate-limited |
| Place search | Express API searches mapped parks, gardens, nature reserves, woods, grassland, and grass-tagged spaces | Map tags do not prove a place is public, open, accessible, or safe |
| Walking routes | Backend requests pedestrian route geometry, distance, duration, and available turn instructions; route service plans a trip to the destination and back | Estimates only; no live closure, lighting, sidewalk, crossing, or safety verification |
| Mission generation | Gemma 3 4B via Ollama, with fallback mission behavior | Output is model-generated and should be reviewed; feasibility is not guaranteed by the model alone |
| Voice | Browser speech synthesis for mission briefing and directions | Voice availability and voice quality vary by browser/device |
| GPS | Browser geolocation after user action | No claim of continuous/background GPS tracking or verified mission completion |
| Persistence | No account or database is required for the basic prototype | Mission history and preferences are not persisted across sessions |

## Architecture

```text
React + Vite + TypeScript + React-Leaflet
                  |
                  v
        Express + TypeScript API
          /        |          \
         v         v           v
   Overpass     Valhalla    FastAPI AI service
   place data   pedestrian       |
                routing          v
                           Ollama + Gemma 3 4B
```

**Open innovation:** Gemma can be run locally through Ollama, so mission generation does not require sending the mission prompt to a proprietary hosted LLM API. The model can be replaced or its prompting changed by the project maintainer. The complete app is **not offline**: place discovery, map tiles, and pedestrian routing use internet services, and browser geolocation is handled by the user's browser.

## Tech stack

- **Frontend:** React 18, Vite, TypeScript, React-Leaflet, Leaflet, Lucide React
- **API:** Node.js, Express, TypeScript, Zod
- **AI service:** Python, FastAPI, Pydantic, Ollama, Gemma 3 4B
- **Mapping data:** OpenStreetMap and public Overpass instances
- **Pedestrian routing:** Valhalla public routing service
- **Optional text-to-speech API route:** ElevenLabs, when configured with a server-side API key. The main browser experience can use browser speech synthesis without this key.

## Prerequisites

Install the following before running the complete local app:

- Node.js 20 or newer and npm
- Python 3.10 or newer with `pip`
- [Ollama](https://ollama.com/) installed and running
- Internet access for npm/pip packages, map tiles, Overpass place search, and Valhalla routing

## Run locally

Run each component in its own terminal. The API and frontend can run without the AI service, but mission generation will use fallback behavior if the Python service or model is unavailable.

### 1. Start Ollama and pull Gemma

Install Ollama, then run:

```bash
ollama pull gemma3:4b
```

Ensure the Ollama service is running and the model is available before testing AI-generated missions. On systems where Ollama is not already running as a service, start it with `ollama serve` in its own terminal.

The current AI service calls `http://127.0.0.1:11434/api/chat` and uses the model name `gemma3:4b`.

### 2. Start the Python AI service

From the repository root:

**Windows PowerShell**

```powershell
cd backend/ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**macOS / Linux**

```bash
cd backend/ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Verify the service at `http://127.0.0.1:8000/health`. The endpoint should return the service name and configured model.

### 3. Start the Express API

Open a new terminal at the repository root:

**Windows PowerShell**

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

**macOS / Linux**

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The API defaults to `http://localhost:4000`. Check `http://localhost:4000/health`.

The API uses `AI_SERVICE_URL` when set; otherwise it expects the local Python service at `http://127.0.0.1:8000`. If the AI service is hosted elsewhere, set `AI_SERVICE_URL` in `backend/.env` to the reachable internal or public base URL. Do not put secrets in frontend environment variables.

### 4. Start the frontend

Open one more terminal at the repository root:

**Windows PowerShell**

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

**macOS / Linux**

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

The frontend reads `VITE_API_BASE_URL`, which defaults to `http://localhost:4000/api/v1`. For deployment, set this to the browser-reachable URL of the deployed API and rebuild the frontend. Variables prefixed with `VITE_` are exposed to the browser; never place API keys or other secrets in them.

## API reference

### Health checks

- `GET http://localhost:4000/health` — Express API health
- `GET http://127.0.0.1:8000/health` — Python AI service health

### Find nearby places

`GET /api/v1/maps/nearby?latitude=19.076&longitude=72.8777&radiusMeters=2000`

Query parameters:

- `latitude`: decimal latitude from `-90` to `90`
- `longitude`: decimal longitude from `-180` to `180`
- `radiusMeters`: integer from `100` to `10000`

The response includes the origin, radius, result count, and mapped place records. Public Overpass instances may throttle or temporarily fail; the API attempts configured instances and caches successful query responses briefly.

### Calculate a walking round trip

`POST /api/v1/maps/route`

Example request body:

```json
{
  "start": { "latitude": 19.076, "longitude": 72.8777 },
  "destination": { "latitude": 19.0772416, "longitude": 72.8816145 }
}
```

The response includes route geometry, distance in metres, estimated duration in seconds, available turn instructions, and a note that these are estimates.

### Generate a mission preview

`POST /api/v1/missions/preview`

Example request body:

```json
{
  "available_minutes": 30,
  "radius_meters": 1500,
  "nearby_places": ["Mapped garden"]
}
```

`available_minutes` accepts `15`, `30`, `45`, or `60`. `radius_meters` must be an integer between `100` and `10000`. A response includes a title, objective, duration, radius, instructions, and `phone_free` flag. If the local AI service cannot be reached, Express returns a deterministic fallback mission.

### Optional voice API

`POST /api/v1/voice/mission` accepts a JSON body with a non-empty `text` string and uses ElevenLabs text-to-speech if `ELEVENLABS_API_KEY` is configured on the server. This optional route is separate from browser speech synthesis used by the frontend.

## Development checks

Run the available checks before opening a pull request:

```bash
# Backend type-check
cd backend
npm run typecheck

# Backend production build
npm run build

# Frontend TypeScript + production build
cd ../frontend
npm run build

# Python syntax check
cd ..
python -m compileall backend/ai
```

The repository does not currently define a comprehensive automated test suite. Please report manual test steps and results in your pull request, especially for routing and model-dependent behavior.

## Contributing

Contributions are welcome! Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), follow the community expectations in [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), and open an issue before large changes.

## Safety, privacy, and external services

- Request location permission only when needed and explain what the feature does.
- Coordinates are sent to the configured API for place discovery and route planning. Those requests may go to third-party OpenStreetMap/Overpass and Valhalla services.
- Never describe a mapped place or calculated route as verified safe, accessible, open, or wheelchair-accessible unless that has been independently verified.
- Keep the user aware of their surroundings; don't require screen interaction while walking.
- Do not log precise location, API keys, or unnecessary personal data.
- Public map/routing services have their own usage policies, service limits, and attribution requirements. Follow those policies before any production deployment.

## License

GrassRoute is licensed under the MIT License.
See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [OpenStreetMap](https://www.openstreetmap.org/) contributors for map data
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) for querying mapped features
- [Valhalla](https://github.com/valhalla/valhalla) and the configured routing service for pedestrian route estimates
- [Ollama](https://ollama.com/) for local model serving
- [Gemma](https://ai.google.dev/gemma) for the open-weight model family
