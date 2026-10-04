# RhizoSense V1 → V2 Audit

> This document is completed after a comprehensive, file-by-file inspection of the entire RhizoSense repository, including frontend source, backend routes, schemas, services, state management, simulator scenarios, test suites, and the authoritative V2 specification documents (`00_` through `12_`).

---

## 1. Current Stack

### Frontend
- **Framework**: React 19 (`react` 19.0.0, `react-dom` 19.0.0) with TypeScript (`typescript` ~5.7.2 / target ES2022).
- **Build tool**: Vite 6.2.0 (`@vitejs/plugin-react` 4.3.4), ES modules, PostCSS.
- **State management**: React Context API (`frontend/src/state/FarmContext.tsx`), custom consumer hook (`useFarm`). Dispatches state updates received from REST polling and WebSocket events. No external state libraries (Redux/Zustand) installed.
- **UI system**: Tailwind CSS 3.4.17 (`tailwindcss`, `postcss`, `autoprefixer`), Lucide React icons (`lucide-react` 0.475.0), custom accessible status badges, cards, and notification panels. Light theme design system.
- **Charts**: Recharts 2.15.1 (`recharts`), wrapped in modular components (`ChartContainer.tsx`, `TrendChart.tsx`, `ComparisonChart.tsx`).
- **Existing routing**: `react-router-dom` 7.2.0 using `BrowserRouter` with routes in `frontend/src/App.tsx`:
  - `/overview`: `OverviewPage` (Farm KPIs, active alerts, environmental risk panel, field status grid)
  - `/fields`: `FieldsPage` (6-field status grid, filters, summary indicators)
  - `/fields/:fieldId`: `FieldDetailPage` (Field telemetry, soil moisture, crop health, AI assessment, recommendations, edge vision panel)
  - `/analytics`: `AnalyticsPage` (Historical trend charts, multi-metric comparison, 24H/7D/30D selector)
  - `/notifications`: `NotificationsPage` (Paginated notification list, status/severity filters, resolve actions)
  - `*`: Catch-all redirect to `/overview`

### Backend
- **Framework**: FastAPI 0.115.11 running on Uvicorn 0.34.0 (ASGI, Python 3.11/3.12 compatibility), Pydantic v2 schemas with camelCase aliasing (`by_alias=True`).
- **API**: REST endpoints mounted with prefix `/api` in `backend/app/api/routes.py`:
  - `GET /api/health`: Health status and ISO-8601 timestamp
  - `GET /api/farm`: Aggregated farm summary, environmental risk summary, edge system status
  - `GET /api/fields`: List of all field summaries
  - `GET /api/fields/{field_id}`: Full telemetry, crop health, risk assessment, and recommendation for a single field
  - `GET /api/notifications`: Filtered notifications (by status, severity, fieldId, limit)
  - `POST /api/notifications/{notification_id}/resolve`: Mark notification resolved and broadcast event
  - `POST /api/recommendations/{recommendation_id}/review`: Mark recommendation reviewed and broadcast event
  - `GET /api/analytics`: Historical time-series metrics (up to 3 metrics, 24h/7d/30d periods)
  - `POST /api/simulator/telemetry`: Ingest external simulator telemetry, trigger rules engine, update state, broadcast updates
  - `POST /api/simulator/reset`: Reset farm state to default baseline
  - `GET /api/vision/detection`: Retrieve current vision detection result for a field
  - `POST /api/vision/detection`: Submit vision detection payload and broadcast event
  - `POST /api/vision/simulate`: Toggle/force simulated disease detection
- **WebSocket**: Starlette/FastAPI native WebSocket endpoint at `/ws` in `backend/app/main.py`. Managed by `backend/app/events/websocket_manager.py` (`ConnectionManager`) broadcasting JSON envelopes:
  - `farm.updated`
  - `field.updated`
  - `field.detail.updated`
  - `notification.created`
  - `notification.resolved`
  - `vision.detection`
- **Rules engine**: Deterministic pure Python rules engine in `backend/app/services/rules_engine.py` (`evaluate_field_condition`). Evaluates volumetric soil moisture, ambient temperature, relative humidity, rainfall, pest level, and disease weather index into statuses (`normal`, `advisory`, `warning`, `critical`), crop health scores, risk assessments, AI assessments with indicator contributions, actionable recommendations, and auto-generated notifications.
- **Persistence**: In-memory singleton in `backend/app/state/farm_state.py` (`FarmStateManager`). State is reset on application restart or via `POST /api/simulator/reset`. No database (SQLite, PostgreSQL, or Redis) exists in V1.

### Simulator
- **Location**: Standalone Python package in `simulator/` directory (`simulator/simulator.py`, `simulator/scenarios/`), with a root convenience script `simulator.py`.
- **Scenarios**: Five deterministic object-oriented scenarios inheriting from `simulator/scenarios/base.py`:
  - `NormalScenario` (`simulator/scenarios/normal.py`): Optimal moisture (45-55%), normal temp (28-30°C), stable humidity (58-62%), low pest activity (8-12%).
  - `DroughtScenario` (`simulator/scenarios/drought.py`): Progressive soil moisture depletion (48% down to 14%), rising canopy temperature (30°C to 38°C), dropping humidity (58% to 35%).
  - `PestScenario` (`simulator/scenarios/pest.py`): Rapid infestation progression (pest index 10% to 85%), slight temperature increase (29°C to 33°C).
  - `HeatScenario` (`simulator/scenarios/heat.py`): Extreme canopy heat surge (30°C to 44°C), soil moisture drop (45% to 22%), humidity drop.
  - `FloodScenario` (`simulator/scenarios/flood.py`): Heavy rainfall event (up to 75mm), soil saturation spike (45% to 94%), waterlogging risk.
- **Transport**: Synchronous HTTP POST requests using the Python `requests` library sending JSON payloads to `http://127.0.0.1:8000/api/simulator/telemetry` at configurable tick intervals (default 1.0s).

---

## 2. Existing Features

| Feature | Existing | Reusable | V2 Change Needed |
|---|---|---|---|
| **Farm overview** | Yes (`OverviewPage.tsx`, `/api/farm`) | Yes | Segregate into Farmer App (`FR-001`: actions required, actionable alerts, simplified farm health) and FPO/Admin Dashboard (`FR-011`: macro view, aggregate risk, connected analytics). Update data models to canonical V2 contracts. |
| **Field map** | Yes (`FieldStatusGrid.tsx`, `FieldsPage.tsx`) | Partial | Replace 6 macro-fields (`field-a` to `field-f`, 1.8–2.4 acres) with 5 m × 5 m spatial micro-zones (`FR-002`, `03_DATA_CONTRACT.md`: `zone_id`, `row`, `column`, `grid_size_m: 5`). Update status enums from `normal`/`advisory`/`warning`/`critical` to `HEALTHY`/`MONITOR`/`ATTENTION`/`ACTION_REQUIRED`. |
| **Zone details** | Partial (`FieldDetailPage.tsx` for macro-fields) | Partial | Refactor into Zone Detail (`FR-003`), Diagnosis (`FR-005`), and Why? (`FR-006`) screens. Expose canonical `DiagnosisResult` (`condition`, semantic confidence tier `LOW`/`MEDIUM`/`HIGH`, risk level, evidence array, environmental match, actionable recommendation). |
| **Alerts** | Yes (`NotificationsPage.tsx`, `NotificationList.tsx`, `/api/notifications`) | Yes | Transform from social-style notification log into a prioritized farmer action queue (`FR-008`). Align severity levels with V2 risk levels (`ACTION_REQUIRED`, `ATTENTION`, `MONITOR`). Implement offline action queue and sync reconciliation. |
| **Analytics** | Yes (`AnalyticsPage.tsx`, `ComparisonChart.tsx`, `TrendChart.tsx`, `/api/analytics`) | Yes | Retain intact for FPO/Admin Dashboard (`FR-012`). Restrict to connected mode. Keep completely decoupled from offline farmer workflow. |
| **Sensor simulation** | Yes (`simulator/`, 5 scenarios, `/api/simulator/telemetry`) | Yes | Adapt telemetry payload to match `05_SENSOR_INTERFACE.md` (include `zone_id`, `metric`, `value`, `unit`, `timestamp`, `source: "simulator"`). Retain mathematical scenario curves. |
| **Rules engine** | Yes (`backend/app/services/rules_engine.py`) | Yes | Evolve into Multimodal Fusion and Risk Engine (`06_FUSION_AND_RISK_ENGINE.md`). Fuse visual evidence + sensor evidence + environmental context window. Output canonical `DiagnosisResult` with semantic confidence tiers (`LOW`, `MEDIUM`, `HIGH`) and explicit What/Why/Action payload. |
| **WebSocket** | Yes (`backend/app/events/websocket_manager.py`, `frontend/src/services/websocket.ts`) | Yes | Standardize event envelope types for V2 (`zone.updated`, `diagnosis.created`, `sync.status`). Maintain auto-reconnect loop and wire to offline sync state manager. |

---

## 3. V2 Gaps

1. **5 m × 5 m Spatial Grid Model (`FR-002`, `03_DATA_CONTRACT.md`)**:
   - V1 models 6 macro-fields (`field-a` through `field-f` of 1.8–2.4 acres).
   - V2 requires 5 m × 5 m micro-zones (e.g. Zone `B3`, `row`: 2, `column`: 3, `grid_size_m`: 5) with discrete risk states (`HEALTHY`, `MONITOR`, `ATTENTION`, `ACTION_REQUIRED`).
2. **Explainability ("Why?") Screen & Evidence Chain (`FR-006`, `08_UI_UX_SPEC.md` Screen 6)**:
   - V1 provides only brief text in `recommendation.reason` and high/med/low contribution badges in `AIAssessment`.
   - V2 requires a dedicated Why? screen connecting: `Visual Evidence + Sensor Evidence + Environmental Window Match → Fusion / Risk Assessment → Recommendation`.
3. **Multilingual Voice Playback (`FR-007`)**:
   - V1 has zero audio/voice infrastructure.
   - V2 requires voice advisory playback in Tamil, Hindi, and English with clear playback state indicators.
4. **Offline-First Persistence & Sync Manager (`FR-009`, `FR-010`, `07_OFFLINE_FIRST.md`)**:
   - V1 relies entirely on live HTTP/WebSocket connectivity; network disconnection causes failed fetch requests and empty states.
   - V2 requires offline as a first-class mode: browser-side local persistence, local event queue with retry metadata, UI indicators for Internet, Edge AI, Storage, and Sync state, plus automatic queued synchronization when connectivity returns.
5. **Crop Scan Workflow (`FR-004`, `08_UI_UX_SPEC.md` Screen 3)**:
   - V1 embeds a static mock card (`EdgeVisionPanel.tsx`) on the macro-field detail page.
   - V2 requires a dedicated Scan screen featuring camera/video feed selection, zone targeting, capture action, edge connection status, AI readiness, and analysis progress.
6. **Prerecorded Video ML Adapter & Canonical Visual Evidence (`04_ML_INTERFACE.md`)**:
   - V1 uses a simple boolean toggle (`POST /api/vision/simulate`) with raw fields `{detected, disease, confidence}`.
   - V2 requires frame extraction from captured images or prerecorded demo video, processed through an ML adapter returning canonical `VisualEvidence` (`type`, `detected`, `confidence`, `source: "vision"`).
7. **Canonical Risk Levels & Confidence Tiers (`03_DATA_CONTRACT.md`)**:
   - V1 uses `normal`, `advisory`, `warning`, `critical` and numeric confidence percentages (e.g., `91%`).
   - V2 requires exact semantic enums: Risk Levels (`HEALTHY`, `MONITOR`, `ATTENTION`, `ACTION_REQUIRED`) and Confidence Tiers (`LOW`, `MEDIUM`, `HIGH`).
8. **Farmer App vs. FPO/Admin Dual-Interface Architecture (`00_PROJECT_CONTEXT.md`)**:
   - V1 merges all features into a single desktop-oriented dashboard.
   - V2 requires two distinct user experiences: a mobile-optimized, action-first Farmer App (7 screens) and an analytics-oriented FPO/Admin Dashboard.

---

## 4. Reuse Candidates

### Exact Frontend Files & Components
- `frontend/src/components/charts/ComparisonChart.tsx`: Fully reusable for FPO/Admin Analytics comparison.
- `frontend/src/components/charts/TrendChart.tsx`: Fully reusable for time-series trend visualization.
- `frontend/src/components/charts/ChartContainer.tsx`: Reusable responsive chart wrapper with header and legend slots.
- `frontend/src/components/notifications/NotificationToast.tsx` & `NotificationToastContainer.tsx`: Reusable for real-time alert toasts.
- `frontend/src/components/status/SeverityIcon.tsx` & `StatusBadge.tsx`: Reusable after updating color mappings to V2 risk levels.
- `frontend/src/components/environmental/EdgeSystemPanel.tsx`: Reusable for system status display in Admin and Offline screens.
- `frontend/src/services/websocket.ts`: Robust WebSocket client with auto-reconnection and typed event listeners.
- `frontend/tailwind.config.js` & `frontend/src/index.css`: Design system foundation, accessible color palette, focus ring styling.

### Exact Backend Files & Services
- `backend/app/events/websocket_manager.py`: `ConnectionManager` is asynchronous, thread-safe, and cleanly handles JSON envelope broadcasts.
- `backend/app/schemas/enums.py`: Retain metric types (`soil_moisture`, `temperature`, `humidity`), notification states, and connection statuses.
- `backend/app/services/rules_engine.py`: Core threshold calculation logic (volumetric water stress, heat thresholds, pest indexing) can be directly incorporated into the fusion engine.
- `backend/tests/test_backend.py`: Pytest structure and FastAPI `TestClient` fixtures can be extended for contract verification.

### Exact Simulator Files
- `simulator/scenarios/base.py`: Clean abstract scenario base class with noise generation.
- `simulator/scenarios/normal.py`, `drought.py`, `pest.py`, `heat.py`, `flood.py`: Agronomic progression curves and parameter drift logic can be preserved with zone-level addressing.
- `simulator/simulator.py`: CLI runner with argument parsing, interval control, and reset capabilities.

---

## 5. Refactor Candidates

| File / Component | Nature of Refactor | Reason |
|---|---|---|
| `backend/app/schemas/enums.py` & `models.py` | Add V2 enums (`RiskLevel`, `ConfidenceTier`) and canonical schemas (`Zone`, `VisualEvidence`, `SensorReading`, `DiagnosisResult`, `EnvironmentalMatch`, `Advisory`, `SyncRecord`). | Align with `03_DATA_CONTRACT.md` without immediately breaking legacy consumers. |
| `backend/app/services/rules_engine.py` → `fusion_engine.py` | Evolve from single-field rule evaluation to multimodal fusion combining visual evidence, sensor readings, and environmental context into `DiagnosisResult`. | Satisfies `06_FUSION_AND_RISK_ENGINE.md` and provides explicit What/Why/Action explainability. |
| `backend/app/state/farm_state.py` | Refactor from 6 macro-fields to a micro-zone grid (e.g. 5×5 grid cells `A1` to `E5`), store `DiagnosisResult` per zone, support local persistence backing, and handle offline synchronization payloads. | Replaces macro-field model with 5 m × 5 m zoning (`FR-002`) and supports offline sync reconciliation (`07_OFFLINE_FIRST.md`). |
| `backend/app/api/routes.py` | Add V2 endpoints: `/api/zones`, `/api/vision/infer`, `/api/sensors/readings`, `/api/diagnosis`, `/api/sync`; maintain backward compatibility adapters for legacy endpoints. | Satisfies `09_API_SPEC.md` while keeping existing tests and simulator operational. |
| `frontend/src/types/index.ts` | Introduce canonical TypeScript interfaces matching `03_DATA_CONTRACT.md` (`Zone`, `VisualEvidence`, `SensorReading`, `DiagnosisResult`, `RiskLevel`, `ConfidenceTier`). | Guarantees end-to-end type safety between backend Pydantic models and React UI. |
| `frontend/src/state/FarmContext.tsx` | Extend state to track network connectivity (`navigator.onLine`), local storage state, sync queue, and active user interface mode (Farmer vs Admin). | Required for first-class offline mode (`FR-009`) and opportunistic sync (`FR-010`). |
| `frontend/src/services/api.ts` | Wrap API calls with local cache fallbacks and queued mutations when offline. | Prevents unhandled network errors when the app operates disconnected. |
| `frontend/src/components/fields/FieldStatusGrid.tsx` | Refactor from 6 macro-cards into an interactive 5 m × 5 m grid map with color-coded risk levels and zone selection. | Satisfies `FR-002` and `08_UI_UX_SPEC.md` Screen 2. |
| `frontend/src/pages/FieldDetailPage.tsx` | Break down into modular screens: Zone Detail (`FR-003`), Diagnosis (`FR-005`), Advisory (`FR-007`), and Why? (`FR-006`). | Follows the "Farm condition → Problem → Action" design principle and 7-screen specification. |
| `frontend/src/components/vision/EdgeVisionPanel.tsx` | Refactor into the dedicated Crop Scan screen (`FR-004`) with frame capture, video adapter hook, and inference progress. | Moves vision from an obscure sub-panel into a core primary farmer workflow. |

---

## 6. Removal Candidates

*Note: In accordance with `12_GEMINI_RULES.md`, only code that is demonstrably obsolete will be removed.*

1. **`POST /api/vision/simulate` in `backend/app/api/routes.py`**:
   - *Reason*: Directly flips a boolean flag on a macro-field without passing through the canonical ML adapter or multimodal fusion pipeline, violating `04_ML_INTERFACE.md`. Replaced by canonical frame inference and scenario simulation.
2. **Hardcoded simulation toggle in `frontend/src/components/vision/EdgeVisionPanel.tsx`**:
   - *Reason*: Hardcoded button calling `/api/vision/simulate`. Replaced by the dedicated Crop Scan interface.
3. **Legacy Vite boilerplate assets**:
   - `frontend/src/assets/react.svg` and `frontend/src/assets/vite.svg`: Unused template SVGs.

---

## 7. Integration Risks

1. **Data Contract & Schema Mismatch**:
   - V1 uses camelCase serialization via Pydantic aliases (`by_alias=True`), e.g., `soilMoisturePercent`, `cropHealth`. V2 `03_DATA_CONTRACT.md` defines snake_case keys (`zone_id`, `grid_size_m`, `risk_level`, `visual_evidence`, `sensor_evidence`).
   - *Risk*: A mismatch between backend serializer, TypeScript interfaces, and WebSocket envelopes will cause silent UI rendering failures.
   - *Mitigation*: Define strict Pydantic models with explicit aliasing and comprehensive contract tests in Phase 1 before UI changes.
2. **Status Enum Migration**:
   - V1 relies on `normal`, `advisory`, `warning`, `critical` (and numeric confidence e.g. `91%`). V2 requires uppercase `HEALTHY`, `MONITOR`, `ATTENTION`, `ACTION_REQUIRED` and semantic confidence tiers `LOW`, `MEDIUM`, `HIGH`.
   - *Risk*: Existing tests (`test_backend.py`), simulator, and frontend styling will break if enums are swapped abruptly.
   - *Mitigation*: Provide bidirectional mapping helpers during migration so both old and new consumers resolve correctly.
3. **Offline Storage & Synchronization**:
   - *Risk*: Relying on synchronous `localStorage` is capped at ~5MB and blocks the main thread, making it unsuitable for storing diagnostic evidence or scan frames.
   - *Mitigation*: Use an asynchronous IndexedDB wrapper for local caching and event queuing.
4. **Voice Synthesis Platform Variability**:
   - *Risk*: Browser `window.speechSynthesis` varies widely across operating systems (Windows, Linux, Android) and may lack native Tamil and Hindi voice packs without internet access.
   - *Mitigation*: Provide audio synthesis with pre-generated/fallback audio clips for core demo advisories alongside the Web Speech API.
5. **Video Frame Extraction & ML Latency**:
   - *Risk*: Extracting canvas frames from high-resolution video streams in the browser can cause garbage collection spikes or UI stuttering.
   - *Mitigation*: Standardize demo video resolution (e.g. 640×480) and run inference asynchronously without blocking the render loop.
6. **Simulator Zone Addressing**:
   - *Risk*: Current simulator targets `field-c`. If the backend enforces `zone_id` (e.g. `B3`), running the simulator without updating targets will return 404.
   - *Mitigation*: Update simulator scenario configurations to target canonical zones (e.g., `B3`) matching `10_DEMO_SCENARIO.md`.

---

## 8. Recommended Migration

To maintain stability and enable continuous verification, the migration must proceed in small, self-contained phases:

```text
Phase 1: Canonical Contracts & Schemas
  ├── Define V2 Pydantic schemas (backend/app/schemas/canonical.py)
  ├── Define V2 TypeScript types (frontend/src/types/index.ts)
  └── Implement bidirectional schema adapters & contract tests
       ↓
Phase 2: Multimodal Fusion & Risk Engine
  ├── Implement fusion engine (backend/app/services/fusion_engine.py)
  ├── Wire What / Why / Action explainability generation
  └── Unit test fusion against normal, drought, pest, and disease vectors
       ↓
Phase 3: ML & Sensor Adapters with Simulator Update
  ├── Implement ML Adapter supporting mock & prerecorded video frames
  ├── Update simulator scenarios to output canonical SensorReading with zone_id
  └── Expose /api/vision/infer and /api/sensors/readings endpoints
       ↓
Phase 4: Offline-First Engine & Local Persistence
  ├── Implement browser IndexedDB persistence (frontend/src/services/storage.ts)
  ├── Build local event queue with retry metadata & sync manager
  └── Implement /api/sync endpoint in backend
       ↓
Phase 5: Core Farmer App UI (7 Screens)
  ├── Build 5 m × 5 m Field Map grid component
  ├── Build Farm Home, Scan, Diagnosis, Advisory, Why?, and Offline screens
  └── Implement multilingual voice playback (Tamil, Hindi, English)
       ↓
Phase 6: FPO / Admin Dashboard Segregation
  ├── Encapsulate existing V1 Overview, Analytics, and Notifications under /admin
  └── Provide clear role/mode navigation switcher
       ↓
Phase 7: End-to-End Validation
  ├── Run backend test suite and contract tests
  ├── Run frontend type-check and Vite production build
  └── Execute complete 18-step demo rehearsal (10_DEMO_SCENARIO.md)
```

---

## 9. Human Decisions Required

The following decisions cannot be established purely from repository or specification evidence and require human confirmation:

1. **Frontend Local Storage Technology for Offline Engine**:
   - `07_OFFLINE_FIRST.md` states: *"The exact local database technology is not established by the current README. Select a suitable implementation only after inspecting the actual V2 runtime constraints, and document the decision."*
   - *Recommended Option*: Use browser-native **IndexedDB** via a lightweight zero-dependency wrapper (`idb`) for robust asynchronous storage of offline diagnoses, scan frames, and the sync queue.
2. **Voice Playback Implementation Approach**:
   - `FR-007` requires Tamil, Hindi, and English voice playback.
   - *Recommended Option*: Implement browser **Web Speech API (`window.speechSynthesis`)** with language tags (`ta-IN`, `hi-IN`, `en-IN`), paired with **pre-rendered fallback audio clips** for the primary demo scenarios to guarantee flawless offline playback on machines lacking local TTS language packs.
3. **Application Navigation Architecture (Dual Mode vs. Distinct Routes)**:
   - Specification defines two interfaces: Farmer App (action-first, 7 screens) and FPO/Admin Dashboard (analytics, trends, device status).
   - *Recommended Option*: Implement a top-level **Role Switcher** in the navigation header allowing instant toggling between `Farmer Mode` (routes: `/`, `/map`, `/scan`, `/diagnosis`, `/advisory`, `/why`, `/offline`) and `FPO / Admin Mode` (routes: `/admin/overview`, `/admin/analytics`, `/admin/network`), preserving existing V1 analytics while keeping the farmer experience pristine.
4. **Farm Spatial Grid Layout**:
   - V1 uses 6 named fields (`Field A` to `Field F`). V2 uses 5 m × 5 m zones (e.g. `B3`).
   - *Recommended Option*: Model the demo farm as a **5×5 grid (25 zones, A1 through E5)** where Zone `B3` is the canonical demonstration problem zone specified in `10_DEMO_SCENARIO.md`.
5. **Disease & Pathogen Scope for SIH Demo**:
   - V1 references "Early Blight" in tomatoes; V2 `03_DATA_CONTRACT.md` references "Rhizome Rot".
   - *Recommended Option*: Support both "Early Blight" and "Rhizome Rot" in the ML adapter catalog with distinct visual patterns and environmental window matches.
