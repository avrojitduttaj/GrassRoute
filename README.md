# GrassRoute 🌱

**Choose your time. Choose your radius. Start a mission. Put your phone away.**

GrassRoute is an open-source outdoor mission prototype. It combines a React map frontend with a TypeScript/Express backend. The frontend can ask for browser location permission, query mapped outdoor places from OpenStreetMap through the backend, and request a mission preview.

## Project structure

```text
GrassRoute/
├── frontend/  # React + Vite + TypeScript + Leaflet map
├── backend/   # Express + TypeScript API + OpenStreetMap Overpass service
├── .gitignore
└── README.md
```

## Requirements

- Node.js 20 or newer
- npm
- Internet access for installing packages, map tiles, and OpenStreetMap Overpass queries

## Start the backend

Open a terminal in the `backend` folder:

```bash
npm install
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Start the API:

```bash
npm run dev
```

Backend runs at `http://localhost:4000`. Check `http://localhost:4000/health`.

## Start the frontend

Open a second terminal in the `frontend` folder:

```bash
npm install
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Run:

```bash
npm run dev
```

Open `http://localhost:5173`.

## Current features

- Time and straight-line search-radius controls.
- Interactive Leaflet map using OpenStreetMap map tiles.
- Browser geolocation (only after the user clicks Use my location and grants permission).
- Backend search for mapped parks, gardens, nature reserves, and playgrounds via Overpass.
- Mission-preview request to the backend.

## Honest limitations in this prototype

- Nearby markers are mapped outdoor places, not verified entrances or proof of public access.
- The circle is a straight-line radius, not a walkable boundary.
- **Walking-route calculation has not been implemented yet.** The map currently shows place markers, not route polylines.
- The mission endpoint is a placeholder; Gemma/TabPFN are not connected yet.
- It does not run background GPS tracking or claim that a mission was completed.
- Public OpenStreetMap tile and Overpass services can be rate-limited. Respect their usage policies before production deployment.

## API endpoints

- `GET /health`
- `GET /api/v1/maps/nearby?latitude=...&longitude=...&radiusMeters=1500`
- `POST /api/v1/missions/preview`

## Next step

Implement a pedestrian routing provider, display the returned route geometry on Leaflet, and validate that routes fit the time/radius budget before asking the AI to generate a mission.
