# AETHEL-SSS | AI-Powered Underwater Side-Scan Sonar Debris & Anomaly Detection System
> **Smart India Hackathon 2026 (SIH 2026)** — Ministry of Ports, Shipping and Waterways & Indian Naval Hydrography Track

---

## 🌊 Overview & The Unique SIH Winning Angle

Traditional computer-vision approaches fail on Side-Scan Sonar (SSS) data because sonar images are **acoustic backscatter maps**, not optical photographs. 

**AETHEL-SSS** introduces a physics-informed inspection pipeline:
1. **Physics-Based Acoustic Shadow Profiling:**
   Underwater objects cast an acoustic blind spot (shadow) whose length is directly proportional to their height off the seafloor.
   Using the towfish sensor altitude ($H_t$), shadow length ($L_s$), and slant range ($R_s$), the system calculates:
   $$h = \frac{H_t \times L_s}{R_s}$$
2. **Dual-Channel High-Frequency Waterfall Streamer:**
   Renders simultaneous Port beam (75m swath) and Starboard beam (75m swath) with a realistic central Nadir water-column deadzone at 60 FPS.
3. **Marine Hazard Classification Matrix:**
   - **Class A:** Ghost Nets & Entangled Fishing Gear (Ecological hazard)
   - **Class B:** Toxic Industrial & Chemical Barrels (Marine toxicity hazard)
   - **Class C:** Submerged Shipwrecks & Hull Frames (Vessel collision risk)
   - **Class D:** Plastic Agglomerates & Synthetic Refuse
   - **Class E:** UXO (Unexploded Ordnance / Submerged Munitions)
4. **Georeferenced Mission Track & Bathymetric Lawnmower Coverage:**
   Plots real-time survey corridors along strategic Indian maritime zones (e.g., Gulf of Mannar Marine Biosphere, Mumbai Port, or Visakhapatnam approach).
5. **Ministry-Compliant Incident Docket & GIS Exporter:**
   Generates official salvage inspection dockets ready for PDF export and downloadable standard GeoJSON/Shapefile format for QGIS/ArcGIS ingestion.

---

## 🛠 Project Structure

```
c:\Users\HP\Desktop\sihhhhh\
├── index.html            # Main tactical hydrographic console interface
├── css/
│   └── style.css         # Tactical defense/hydrographic UI design system
├── js/
│   ├── palette.js        # 256-step Look-Up Tables (Amber, Copper, Emerald, Mono)
│   ├── sonar-engine.js   # 60FPS dual-channel waterfall canvas & TVG engine
│   ├── ai-detector.js    # Bounding box tracker, shadow formula & sound fx
│   ├── map-tracker.js    # Tactical lawnmower survey map & georeferenced hazard pins
│   ├── docket-export.js  # Ministry of Ports & Shipping incident docket generator
│   └── app.js            # Master orchestrator & API telemetry integration
├── backend/
│   ├── server.py         # Flask REST API server (serves frontend + API)
│   └── sonar_dsp.py      # Python Physics-Informed Acoustic Shadow & DSP Engine
└── README.md             # Project documentation and judging guide
```

---

## 🚀 How to Run the Fullstack Prototype

The unified Fullstack Python + Tactical Frontend server is currently live:

1. **Open your browser and navigate to:**
   👉 **`http://localhost:5000`**
2. Both the frontend and the Python REST backend run unified on port **5000**.
3. To restart or run on another machine:
   ```powershell
   python -m pip install flask numpy pillow
   python backend/server.py
   ```

### 📡 Python Backend REST API Endpoints:
- `GET /api/status` — System health, DSP cores, and radio-acoustic link.
- `GET /api/telemetry` — Live towfish altitude, depth, gyro heading, and GPS coordinates.
- `GET /api/anomalies` — Active target database with acoustic shadow metrics.
- `POST /api/detect` — Runs the acoustic shadow physics formula ($h = \frac{H_t \cdot L_s}{R_s}$) on custom input.
- `POST /api/inject-anomaly` — Injects physics-calibrated anomaly into stream.
- `GET /api/export-docket` — Compiles official Ministry Docket with cryptographic SHA-256 attestation hash.
- `GET /api/survey-track` — Georeferenced lawnmower waypoints in Gulf of Mannar.

---

## ⌨️ Tactile Keyboard Shortcuts & Controls

| Shortcut / Button | Action |
|---|---|
| `Space` | Pause / Resume live acoustic waterfall stream |
| `P` | Cycle Sonar Color Palette (*Amber Phosphor*, *Copper Sepia*, *Glint Emerald*, *Monochromatic*) |
| `F` | **Freeze Target** under cursor for tactical inspection |
| `E` | Open **Ministry Incident Docket & Salvage Report** |
| `Inject Sonar Anomaly` | Manually spawn an acoustic anomaly with highlight and acoustic shadow |
| `Upload Sonar Scan` | Ingest external sonar imagery (.png / .jpg) for static survey analysis |
| `CRT FX` | Toggle tactical CRT phosphor scanline overlay |
| `FREQ Toggle` | Switch between 455 kHz (Wide Swath) and 900 kHz (Hi-Res Detail) |

---

## 🎯 Key Questions SIH Judges Will Ask & How to Answer

1. **"Why not just use YOLO or Faster-RCNN directly on images?"**
   > *"Optical models rely on color, texture, and edges. Side-scan sonar has no color and high speckle noise. Our system pairs acoustic highlight detection with physical shadow length geometry ($h = \frac{H_t \cdot L_s}{R_s}$) to eliminate false alarms from seafloor boulders and extract real-world 3D obstacle clearance."*

2. **"How does the system handle different seabed types?"**
   > *"The console incorporates Time-Varied Gain (TVG) and dynamic contrast tuning to combat spherical spreading loss and acoustic attenuation, allowing seamless detection across muddy estuaries, sandy ridges, and rocky seabeds."*

3. **"How does this integrate into actual marine workflows?"**
   > *"The system produces standardized GeoJSON hazard points with exact Lat/Long coordinates and estimated physical volume, which feeds directly into Indian Coast Guard / Port Authority ROV salvage units via the integrated Incident Docket."*
