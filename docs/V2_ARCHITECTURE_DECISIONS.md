# RhizoSense V2 — Architecture Decisions

This document records the architectural and design decisions established during the V1 to V2 migration for SIH 2026 Problem Statement #26180, resolving the decisions identified during the audit in `docs/V1_AUDIT.md`.

---

## 1. Browser Local Storage Technology for Offline Engine

### Decision
Implement an asynchronous, multi-store **IndexedDB** engine (`RhizoSense_V2_DB`) wrapped by `frontend/src/services/storage.ts`, backed by a transparent `localStorage` fallback.

### Rationale
- `07_OFFLINE_FIRST.md` requires storing diagnostic results, visual evidence, sensor readings, and the synchronization queue locally without blocking UI rendering.
- `localStorage` is synchronous and limited to ~5MB, which risks performance degradation and quota exceptions when handling image frames and telemetry logs.
- IndexedDB provides asynchronous, non-blocking structured storage with 50MB+ capacity across modern mobile and desktop browsers.

### Implemented Object Stores
- `zones`: Cached `Zone` metadata for all 25 spatial zones.
- `diagnoses`: Cached canonical `DiagnosisResult` payloads keyed by `zone_id`.
- `alerts`: Cached action queue notifications.
- `sync_queue`: `SyncRecord` entities pending upload upon network restoration.

---

## 2. Multilingual Voice Advisory Playback

### Decision
Implement a hybrid voice advisory module (`frontend/src/components/voice/VoiceAdvisoryPlayer.tsx`) utilizing the **Web Speech API (`window.speechSynthesis`)** with explicit language codes (`en-IN`, `ta-IN`, `hi-IN`), corroborated by instant on-screen localized transcriptions in English, Tamil, and Hindi.

### Rationale
- `FR-007` mandates actionable voice playback in Tamil, Hindi, and English.
- Relying exclusively on external cloud TTS endpoints (e.g. Google Cloud TTS / AWS Polly) would violate the core offline requirement (`07_OFFLINE_FIRST.md`).
- The Web Speech API runs client-side with native device voices where available. If a device lacks an offline Tamil or Hindi voice pack, the player falls back gracefully to formatted speech bubble transcriptions without throwing runtime errors or disrupting the farmer.

---

## 3. Application Navigation & Dual-Interface Architecture

### Decision
Implement a unified application with a top-level **Role / Interface Switcher** in `frontend/src/components/navigation/Header.tsx`, cleanly separating the **Farmer App (7 Core Screens)** from the **FPO / Admin Dashboard (Connected Analytics)**.

### Rationale
- `00_PROJECT_CONTEXT.md` explicitly defines two distinct user experiences:
  1. **Farmer App**: Mobile-first, action-oriented ("Problem → Why → Action"), voice-first, low cognitive load.
  2. **FPO / Admin Dashboard**: Desktop-oriented, connected-mode analytics, multi-metric comparison charts, network aggregation.
- Sub-routing structure:
  - Farmer App: `/farmer` (Home), `/farmer/map` (5m Grid), `/farmer/scan` (Crop Scan), `/farmer/diagnosis` (Diagnosis), `/farmer/advisory` (Advisory), `/farmer/why` (Explainability), `/farmer/offline` (Sync).
  - Admin Dashboard: `/overview` (Farm Overview), `/fields` (Field Status), `/analytics` (Historical Trends), `/notifications` (Operations Log).
- The root route `/` redirects automatically to `/farmer`.

---

## 4. Farm Spatial Grid Layout (5 m × 5 m Micro-Zones)

### Decision
Model the demonstration farm as a **5 × 5 spatial grid comprising 25 micro-zones (`A1` through `E5`)** with standard physical dimensions of 5m × 5m (25 sq.m per zone).

### Rationale
- `FR-002` and `03_DATA_CONTRACT.md` mandate 5m × 5m zoning with stable zone IDs (`zone_id`, `row`, `column`, `grid_size_m: 5`).
- Rows are indexed 1 to 5 (letters A through E); columns are indexed 1 to 5.
- Zone **`B3`** (row 2, column 3) is established as the canonical demonstration problem zone specified in `10_DEMO_SCENARIO.md`.
- Legacy macro-field IDs (`field-a` to `field-f`) are aliased to corresponding zones (`field-c` aliases to `B3`) in `FarmStateManager` to guarantee 100% backward compatibility for existing tests and legacy consumers.

---

## 5. ML Simulation & Canonical Inference Pipeline

### Decision
Implement an isolated, standardized `MLAdapter` in `backend/app/services/ml_adapter.py` that ingests frame data or prerecorded video presets and emits canonical `VisualEvidence` payloads adhering to `03_DATA_CONTRACT.md`.

### Rationale
- `12_GEMINI_RULES.md` and `04_ML_INTERFACE.md` prohibit connecting raw model outputs directly to React and forbid fabricating an imaginary real ML model when one is not present in the repository.
- The adapter supports 3 standardized demonstration video presets for SIH evaluation:
  1. `rhizome_rot_canopy.mp4` (Wilting + Collar Discoloration)
  2. `early_blight_foliage.mp4` (Foliar Target Spots + Necrosis)
  3. `healthy_crop_control.mp4` (Healthy Canopy Control)
- All visual evidence passes through `MultimodalFusionEngine` before reaching the UI.
