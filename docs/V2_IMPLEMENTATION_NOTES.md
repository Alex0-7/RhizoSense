# RhizoSense V2 — Implementation Notes

This document provides a comprehensive operational guide for the RhizoSense V2 Smart Farming Assistant, built for SIH 2026 Problem Statement #26180.

---

## 1. System Overview

RhizoSense V2 is an edge-native, offline-first multimodal smart farming platform. It monitors 25 spatial micro-zones (5 m × 5 m) using root-zone sensors, canopy computer vision, and microclimate risk rules, presenting an action-first user interface for smallholder farmers and a comprehensive operations dashboard for FPO administrators.

```text
┌─────────────────────────────────────────────────────────────────┐
│                          INPUT SOURCES                          │
│        Canopy Vision (Live/Video)   •   Soil Telemetry          │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│               CANONICAL ADAPTERS & DATA CONTRACTS               │
│               ML Adapter   •   Sensor Normalizer                │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 MULTIMODAL FUSION & RISK ENGINE                 │
│      Visual Symptoms + Soil Telemetry + Environmental Window    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CANONICAL DIAGNOSIS & ADVISORY                 │
│                 What?   •   Why?   •   Action                   │
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
               ▼                                  ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│     FARMER APP (7 SCREENS)   │   │     FPO / ADMIN DASHBOARD    │
│  Home, 5m Map, Scan, Diag,   │   │  Overview, Analytics, Trends │
│  Advisory, Why?, Offline     │   │  Action Queue, Device Status │
└──────────────┬───────────────┘   └──────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│  OFFLINE PERSISTENCE & SYNC  │
│  IndexedDB  •  Retry Queue   │
└──────────────────────────────┘
```

---

## 2. Canonical Contracts & Schemas

Defined in `backend/app/schemas/canonical.py` and `frontend/src/types/canonical.ts`:

### Core Enums
- **RiskLevel**: `HEALTHY`, `MONITOR`, `ATTENTION`, `ACTION_REQUIRED`
- **ConfidenceTier**: `LOW`, `MEDIUM`, `HIGH`
- **SyncStatus**: `PENDING`, `SYNCED`, `FAILED`

### Models
- **`Zone`**: `{ zone_id, row, column, grid_size_m: 5, crop, current_risk, last_updated }`
- **`VisualEvidence`**: `{ type, detected, confidence, source, details }`
- **`SensorReading`**: `{ zone_id, metric, value, unit, timestamp, source }`
- **`EnvironmentalMatch`**: `{ matched: bool, reason: str }`
- **`Advisory`**: `{ action, secondary_action, urgency, reason, voice_text: { en, ta, hi } }`
- **`DiagnosisResult`**: `{ zone_id, timestamp, diagnosis: { condition, confidence, risk_level }, visual_evidence, sensor_evidence, environmental_match, recommendation }`
- **`SyncRecord`**: `{ local_id, event_type, timestamp, payload, sync_status, retry_count }`

---

## 3. Multimodal Fusion Engine

Located in `backend/app/services/fusion_engine.py`:
- Deterministic pure Python engine: identical inputs produce identical outputs.
- Fuses:
  - **Foliar Visual Symptoms**: `wilting`, `rhizome_discoloration`, `leaf_spots`, `necrosis`, `healthy_canopy`.
  - **Soil Telemetry**: `soil_moisture` (saturation >80% vs depletion <20%), `temperature`, `humidity`, `rainfall_mm`, `pest_level`.
  - **Environmental Match Window**: Evaluates pathogen microclimate conditions (humidity >= 75% and 22°C - 34°C).
- Generates localized voice advisory strings in **English**, **Tamil (தமிழ்)**, and **Hindi (हिंदी)**.

---

## 4. ML Frame Adapter

Located in `backend/app/services/ml_adapter.py`:
- Implements the canonical boundary specified in `04_ML_INTERFACE.md`.
- Does not expose arbitrary model JSON directly to React.
- Provides 3 deterministic video presets for SIH evaluation:
  1. `rhizome_rot_canopy.mp4` (Wilting + Collar Discoloration)
  2. `early_blight_foliage.mp4` (Leaf Spots + Focal Necrosis)
  3. `healthy_crop_control.mp4` (Uniform Foliar Spectral Index)
- Target zone `B3` defaults to rhizome rot / damping off to align with `10_DEMO_SCENARIO.md`.

---

## 5. Offline Persistence & Synchronization

- **`frontend/src/services/storage.ts`**: Multi-store IndexedDB wrapper (`zones`, `diagnoses`, `alerts`, `sync_queue`) with synchronous `localStorage` fallback.
- **`frontend/src/services/syncManager.ts`**:
  - Listens to `window.online` and `window.offline` events.
  - Enqueues farmer acknowledgments, manual diagnoses, and alert resolutions locally with unique IDs and retry counters.
  - Automatically executes opportunistic background sync (`POST /api/sync`) when connectivity returns.
  - Supports simulated offline toggling for presentation and testing.

---

## 6. Eight Core Farmer Screens

Located in `frontend/src/pages/farmer/`:
1. **Farm Home (`/farmer`)**: Farm health status banner, actions required counter, prioritized action queue, quick action button for Live Disease Detection (Zone B3).
2. **Field Map (`/farmer/map`)**: 5m × 5m spatial grid of 25 micro-zones (`ZoneGridMap`), color-coded by risk level (`HEALTHY`, `MONITOR`, `ATTENTION`, `ACTION_REQUIRED`), zone inspector card.
3. **Live Disease Detection (`/farmer/detection`)**: Dedicated judge-facing live crop health inspection terminal. Features live video feed / dynamic HUD viewport (`/vision/plant-feed.mp4`), real-time bounding box overlays, confidence meter, corroborating root-zone telemetry from `read_sensors()`, urgency alerts, and one-click multilingual voice player.
4. **Crop Scan (`/farmer/scan`)**: Video/frame source selector (with SIH presets), simulated live camera viewport, frame extraction progress bar, edge AI status badges, canonical visual evidence summary.
5. **Diagnosis (`/farmer/diagnosis`)**: Synthesized condition, confidence tier (`HIGH`, `MEDIUM`, `LOW`), tri-fold evidence breakdown (Visual, Sensor, Environmental Window).
6. **Advisory (`/farmer/advisory`)**: Primary directive, secondary action, integrated `VoiceAdvisoryPlayer` (Tamil, Hindi, English), "Confirm Action Taken" button (queues for offline sync).
7. **Why? (`/farmer/why`)**: Transparent causal evidence chain visually linking raw observations → multimodal fusion → recommended action.
8. **Offline / Sync (`/farmer/offline`)**: Real-time status indicators (Internet, Edge AI, Local Storage, Sync), pending queue list, "Sync Now" button, simulated offline rehearsal toggle.

---

## 7. API Endpoints

### V2 Canonical Endpoints
- `GET /api/zones`: List of all 25 spatial micro-zones (`Zone[]`)
- `GET /api/zones/{zone_id}`: Detail of a specific zone (`Zone`)
- `GET /api/diagnosis/{zone_id}`: Canonical `DiagnosisResult`
- `POST /api/sensors/readings`: Ingest normalized sensor readings (`SensorReading[]`)
- `POST /api/vision/infer`: Run ML adapter + multimodal fusion (`InferenceRequest` -> `InferenceResponse`)
- `POST /api/sync`: Reconcile offline queued actions (`SyncRecord[]`)
- `POST /api/actions/acknowledge`: Log farmer recommendation acknowledgment

### Legacy & Admin Endpoints (Preserved)
- `GET /api/farm`: Aggregated farm summary & environmental indicators
- `GET /api/fields`: List of macro-fields
- `GET /api/fields/{field_id}`: Single field detail
- `GET /api/notifications`: Filtered alert notifications
- `POST /api/notifications/{id}/resolve`: Mark notification resolved
- `POST /api/recommendations/{id}/review`: Mark recommendation reviewed
- `GET /api/analytics`: Time-series historical metrics (24h, 7d, 30d)
- `POST /api/simulator/telemetry`: Telemetry ingestion from simulator
- `POST /api/simulator/reset`: Reset farm & 25 zones to baseline

---

## 8. WebSocket Events (`/ws`)

Broadcast by `backend/app/events/websocket_manager.py`:
- `zone.updated`: Emitted when any zone risk level or state changes.
- `diagnosis.created`: Emitted when a new `DiagnosisResult` is produced.
- `notification.created`: Emitted when an actionable alert is triggered.
- `notification.resolved`: Emitted when an alert is resolved.
- `sync.status`: Emitted upon offline queue reconciliation.
- `farm.updated`: Emitted when aggregate farm state changes.

---

## 9. Commands to Run the Finished System

### 1. Start FastAPI Backend
```bash
# From repository root
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Start React + Vite Frontend
```bash
# In another terminal, from frontend/
npm run dev
```
Open browser to `http://localhost:5173`.

### 3. Run Backend Test Suite
```bash
python -m pytest backend/tests
```

### 4. Build Frontend for Production
```bash
cd frontend && npm run build
```

---

## 10. Executing the 18-Step SIH Demo Scenario (`docs/10_DEMO_SCENARIO.md`)

1. Open `http://localhost:5173/farmer` (Farm Home). Show overall condition and actions required.
2. Click **Open 5m × 5m Field Map** (`/farmer/map`). Show the 25 micro-zones.
3. Select problem **Zone B3** (Row 2, Column 3). Note status badge and details.
4. Click **Start Crop Scan** (`/farmer/scan`).
5. Verify selected video preset: `Rhizome Rot / Wilting Sample (SIH Demo)`.
6. Click **Extract Frame & Infer Zone B3**. Observe frame extraction progress (0% → 100%).
7. View generated canonical visual evidence (`wilting` 91%, `rhizome_discoloration` 82%).
8. Click **Open Full Diagnosis** (`/farmer/diagnosis`).
9. Show the tri-fold evidence: Visual symptoms + Saturated root telemetry + Environmental window matched.
10. Click **Why? Explain Causal Evidence Chain** (`/farmer/why`). Walk through Step 1 → Step 2 → Step 3.
11. Click **Open Voice Advisory** (`/farmer/advisory`).
12. Select language **தமிழ் (Tamil)** or **हिंदी (Hindi)** and press **Play Voice Advisory**.
13. Click **Confirm Action Taken**. Note that the action is recorded and queued.
14. Navigate to **Offline & Sync** (`/farmer/offline`).
15. Click **Simulate Disconnect (Demo)**. Notice the banner switch to OFFLINE mode.
16. Return to Farm Home and Field Map; verify that local diagnosis, advisories, and voice remain fully functional without internet.
17. Return to Offline & Sync and click **Restore Connection**.
18. Click **Sync Now** (or observe automatic sync). Show that all queued actions reconcile with zero lost data.
19. Switch to **FPO / Admin Dashboard** using the header toggle to show aggregate analytics and historical trends.

---

## 11. Live Disease Detection Judge Flow (`/farmer/detection`)

This flow presents the live edge-CV and sensor fusion demo directly to the judges:

1. **Terminal 1 (Backend)**:
   ```bash
   python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
2. **Terminal 2 (Frontend)**:
   ```bash
   cd frontend && npm run dev
   ```
3. **Terminal 3 (Simulator Driving Real Sensors)**:
   ```bash
   python simulator.py --scenario drought --target-zone B3 --duration 30
   ```
4. **Judge Presentation Walkthrough**:
   - Open `http://localhost:5173/farmer/detection?zoneId=B3` directly (or click "Disease Detection" in top navigation or "Live Disease Detection (Zone B3)" on Farm Home).
   - Show the **Live Edge Video Viewport**: If `/vision/plant-feed.mp4` is present, it plays the looping canopy feed; if not, an animated edge scanning HUD displays active target reticles and bounding boxes with 0% risk of crashing.
   - Click **Run Live Inspection**: The Edge AI performs frame extraction and evaluates foliar symptoms (`wilting: 91%`, `rhizome_discoloration: 82%`).
   - Highlight the **Corroborating Root-Zone Sensors Card**: Point out the live telemetry ingested via `read_sensors()` (soil moisture, temperature, humidity).
   - Point to the **Urgent Action Directive**: Clear, actionable language (`ACTION REQUIRED: Drench Zone B3 root area with Trichoderma harzianum @ 20g/L immediately`).
   - Click **Play Voice Advisory**: Plays crystal-clear farmer advisory audio in English, Tamil, or Hindi with zero delay.
   - Click **Why? View Evidence Chain**: Seamlessly leads into the 3-step causal transparency graph.

