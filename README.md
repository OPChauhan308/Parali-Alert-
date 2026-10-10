# 🔥 Parali Alert — Mission Control

> Proactive, AWS-powered geospatial intelligence platform helping authorities in Punjab predict agricultural areas at risk of stubble burning over the next 48 hours and prioritize preventive interventions.

![Parali Alert](https://img.shields.io/badge/Status-Live%20Mission%20Control-brightgreen)
![React](https://img.shields.io/badge/React-18.3-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.0-646cff?logo=vite)
![Deck.gl](https://img.shields.io/badge/Deck.gl-9.1-rgb(30,144,255))
![MapLibre](https://img.shields.io/badge/MapLibre-4.7-blue)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)

---

## 🛰️ Key Features

- **Full-Screen 3D Geospatial Engine:** Native MapLibre GL with MapTiler Satellite Hybrid & Dark Vector basemaps.
- **Glowing Fire Risk (`PolygonLayer`):** WebGL additive blending (`blendColorOperation: 'add'`, `blendColorSrcFactor: 'src-alpha'`, `blendColorDstFactor: 'one'`) for intense, glowing heat effects over high-risk agricultural units.
- **Cinematic Downwind Drift (`TripsLayer`):** Animated particle trajectories simulating smoke and particulate matter drift toward downwind population hubs (Ludhiana, Amritsar, Patiala, Jalandhar, New Delhi).
- **Intervention Queue (Left Panel):** Real-time priority ranking of vulnerable grids with NDVI, NDTI, AQI sparklines, residue density, and predicted burn windows.
- **Active Simulation Mode:** Expand any grid and click **"Dispatch Bio-Decomposer"** to watch the risk score animate to zero (`framer-motion`) and the map polygon turn emerald green.
- **Telemetry & Terminal Feed (Right Panel):** Live stream simulating ingestion from AWS Lambda, Sentinel-2 (NDVI/NDTI), NASA FIRMS, and ECMWF ERA5.
- **Draggable Temporal Replay (-48h to +48h):** Interactive timeline scrubber for historical replay and predictive risk projection.
- **Hover HUD:** Trailing dark-mode tooltip showing exact coordinates, burn window, risk %, wind speed, and air quality index.

---

## 🛠️ Tech Stack

- **Frontend Core:** React 18, TypeScript, Vite
- **Map & WebGL:** `maplibre-gl`, `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/geo-layers`, `@deck.gl/mapbox`
- **UI & Animations:** Tailwind CSS, Framer Motion, Lucide React
- **State Management:** Zustand
- **Basemap Provider:** MapTiler Cloud (Satellite Hybrid v4 & Dataviz Dark)

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/OPChauhan308/Parali-Alert-.git
cd Parali-Alert-
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment configuration
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Add your MapTiler API key (free at [maptiler.com](https://cloud.maptiler.com/)):
```env
VITE_MAPTILER_KEY=your_maptiler_key_here
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Production Build
```bash
npm run build
```

---

## 📁 Project Structure

```
├── src/
│   ├── api/
│   │   └── client.ts            # Future API client ready for Python FastAPI routes
│   ├── components/
│   │   ├── MapView.tsx          # Deck.gl additive PolygonLayer + TripsLayer + MapLibre
│   │   ├── LeftPanel.tsx        # Intervention Queue & Bio-Decomposer dispatch
│   │   ├── RightPanel.tsx       # Telemetry, Sparklines & Live Terminal Feed
│   │   └── TimelineSlider.tsx   # -48h to +48h Draggable Timeline Scrubber
│   ├── data/
│   │   └── mock_state.json      # Mock payload mirroring risk_engine.py & cog_service.py
│   ├── store/
│   │   └── useStore.ts          # Zustand global state (selection, timeline, simulation)
│   ├── App.tsx                  # Floating mission control frosted-glass layout
│   ├── main.tsx                 # React DOM root entry
│   └── index.css                # Tailwind CSS & global styling
├── .env.example                 # Environment variable template
├── .gitignore                   # Ignored files (node_modules, .env, dist)
└── package.json
```
