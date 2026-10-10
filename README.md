# Parali Alert (ਪਰਾਲੀ ਅਲਰਟ)

> **Predictive Pre-Fire Intelligence for Crop Residue Management in Punjab**
> *Stopping stubble burning before the first spark, not after the smoke clears.*

---

## The Core Idea

Every autumn, northern India faces a severe air quality crisis triggered by widespread paddy stubble burning.

Traditional tracking relies on thermal satellite alerts like NASA FIRMS. The problem? **Thermal sensors only trigger when a fire is already blazing.** By the time an alert sounds, the smoke is airborne and civil authorities can only react with fines or fire tenders.

**Parali Alert flips the model from reactive suppression to proactive intervention.**

Instead of looking for fires, we track the **1 to 5 day window** between when a field is harvested and when a farmer is likely to burn the remaining straw. By combining satellite imagery, weather data, and historical burn patterns, Parali Alert identifies high-risk villages in advance—allowing district officers to deploy Happy Seeders, balers, and field teams *before* ignition happens.

---

## How It Works

```
  [ Sentinel-2 (Optical) ]     [ Sentinel-1 (Radar) ]     [ Open-Meteo & FIRMS ]
              │                           │                         │
              └───────────────────┬───────┴─────────────────────────┘
                                  ▼
                     [ Smart Ingestion Engine ]
                 • Extracts B04, B08, B11, B12 Bands
                 • Cloud-Piercing SAR Radar Checks
                                  ▼
                     [ Deterministic Risk Model ]
                 • NDVI Drop  ➔  Harvest Detection
                 • NDTI Index ➔  Unburned Straw Volume
                 • Wind Vector ➔ Downwind Airshed Risk
                                  ▼
                  [ Interactive Command Console ]
                 • Real-Time Risk Map & Village Priorities
                 • Direct CSV Action Manifests for Teams

```

### 1. Spotting the Harvest

When paddy is cut, the field’s greenness drops sharply. We monitor **Sentinel-2 NDVI** ($\Delta\text{NDVI} > 0.20$) to pinpoint exactly when harvest occurs down to the field level.

### 2. Measuring Unburned Residue

Bare soil looks different from soil covered in dry paddy straw. Using Short-Wave Infrared (SWIR) bands, we calculate the **Normalized Difference Tillage Index (NDTI)** to isolate unmanaged crop residue.

### 3. Piercing the Fog with Radar

Morning fog and heavy aerosol haze frequently blind optical satellites in October and November. Parali Alert integrates **Sentinel-1 SAR Radar**. Because radar microwaves pass straight through clouds and fog, we maintain 24/7 all-weather surveillance over every field.

### 4. Predicting Downwind Impact

By pulling real-time wind vectors and weather metrics from Open-Meteo, the platform prioritizes interventions in villages that are directly upwind of high-density population corridors like Delhi-NCR.

---

## Key Highlights

* **Ultra-Fast Data Fetching:** Uses HTTP Range Requests against Cloud-Optimized GeoTIFFs (COGs) on AWS Open Data. Instead of downloading full 500 MB satellite files, it streams tiny 58 KB pixel slices directly into memory.
* **Explainable Risk Scoring:** No opaque black-box ML. Risk priority is calculated using transparent, deterministic factors: **Fire Risk $\times$ Intervention Window $\times$ Environmental Impact**.
* **Zero API Costs:** Built entirely on open-access feeds—NASA FIRMS, Open-Meteo, and Sentinel registries on AWS.

---

## Quickstart

### Prerequisites

* Python 3.10+
* Node.js 18+

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/OPChauhan308/Parali-Alert-.git
cd Parali-Alert-

# Set up environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r backend/requirements.txt

# Run tests
pytest

```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run build
cd ..

```

### 3. Start the Server

```bash
python3 -m uvicorn backend.app:app --host 127.0.0.1 --port 8000

```

Visit **`[http://127.0.0.1:8000](http://127.0.0.1:8000)`** in your browser to access the command console.

---

## Project Structure

```
Parali-Alert-/
├── backend/            # FastAPI backend & satellite logic
│   ├── app.py          # Application endpoints & routing
│   ├── algorithms/     # Spectral index & risk scoring models
│   └── services/       # COG streamer & weather API integration
├── frontend/           # React dashboard & map interfaces
│   ├── src/            # Components, MapLibre/Leaflet views, queue UI
│   └── public/         # Static assets & map styles
├── data/               # Sample village geometries & test vectors
└── tests/              # Automated test suite

```

---

## License

Distributed under the [MIT License](https://www.google.com/search?q=LICENSE). Built for civil authorities, agricultural departments, and environmental researchers working toward clean air solutions.
