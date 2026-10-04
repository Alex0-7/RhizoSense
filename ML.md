# RhizoSense — Edge Vision & ML Model Integration Guide

This document is for the machine learning (ML) / computer vision (CV) engineer. It outlines the architectural requirements, API contracts, video guidelines, and sample Python scripts needed to integrate an edge-native plant disease detection model with the **RhizoSense** dashboard.

---

## 1. System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   EDGE CAMERA FEED                     │
│           (Camera / RTSP / Simulated MP4)              │
└──────────────────────────┬─────────────────────────────┘
                           │ Raw Video Frames (24-30 FPS)
                           ▼
┌────────────────────────────────────────────────────────┐
│                   CV / ML PIPELINE                     │
│      (YOLOv8 / MobileNet / ResNet / TFLite / QNN)      │
│  - Object detection & foliage segmentation             │
│  - Disease pathology classification                   │
│  - Confidence scoring & state-change throttling        │
└──────────────────────────┬─────────────────────────────┘
                           │ Clean JSON Contract (1-2 Hz or State Change)
                           ▼
┌────────────────────────────────────────────────────────┐
│             RHIZOSENSE FASTAPI BACKEND                 │
│         POST /api/vision/detection?fieldId=field-c     │
│  - State updates & transition detection (false -> true)│
│  - Creates ONE warning notification                    │
│  - Broadcasts live WebSocket event ("vision.detection")│
└──────────────────────────┬─────────────────────────────┘
                           │ WebSocket / REST
                           ▼
┌────────────────────────────────────────────────────────┐
│               REACT + TYPESCRIPT UI                    │
│                 (/fields/field-c)                      │
│  - Live video feed playback (continuous loop)          │
│  - Real-time detection HUD (Warning / Nominal badge)   │
│  - Exact confidence display (e.g., 91%)                │
│  - Instant non-intrusive toast alert                   │
└────────────────────────────────────────────────────────┘
```

---

## 2. The Minimal JSON Contract

The dashboard expects **strictly three fields**. Do not invent custom nested objects or rename these keys.

### A. When a Disease is Detected
```json
{
  "detected": true,
  "disease": "Early Blight",
  "confidence": 0.91
}
```

* **`detected`** (*boolean, required*): `true` if a pathological condition is detected above the confidence threshold.
* **`disease`** (*string, required*): Name of the detected plant disease (e.g., `"Early Blight"`, `"Late Blight"`, `"Powdery Mildew"`).
* **`confidence`** (*float, required*): Model confidence score between `0.0` and `1.0`. The dashboard displays this as an exact percentage (`0.91` → `91%`).

---

### B. When No Disease is Detected (Healthy / Nominal Canopy)
```json
{
  "detected": false,
  "disease": null,
  "confidence": 0.12
}
```

* **`detected`** (*boolean*): `false`.
* **`disease`** (*null*): `null` (or Python `None`).
* **`confidence`** (*float*): Baseline model noise/uncertainty (e.g., `0.05` to `0.20`).

---

## 3. Backend Ingestion API

The ML pipeline sends detection results to the RhizoSense backend via HTTP POST.

### Endpoint
```http
POST /api/vision/detection?fieldId={field_id}
Content-Type: application/json
```

### Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `fieldId` | Query String | No | `field-c` | Target field identifier (e.g. `field-c`, `field-a`). |

### URLs
* **Local Development**: `http://127.0.0.1:8000/api/vision/detection?fieldId=field-c`
* **Cloud Deployment (Render)**: `https://<YOUR-RENDER-APP>.onrender.com/api/vision/detection?fieldId=field-c`

### What the Backend Does Automatically
1. Stores the latest detection state for that field.
2. If `detected` transitioned from `false` → `true`:
   - Creates **ONE** persistent warning notification in the RhizoSense alert registry.
   - Dispatches a toast notification to the live frontend.
3. Broadcasts the `vision.detection` WebSocket event to all connected dashboard clients so the UI updates instantly without page reload.
4. If `detected` remains `true`, it **does not spam** duplicate notifications.

---

## 4. Simulated Camera Video Asset

The dashboard displays a synchronized video feed representing the canopy camera.

### File Location
Place your demonstration MP4 video at:
```text
frontend/public/vision/plant-feed.mp4
```

### Video Specifications
* **Filename**: `plant-feed.mp4`
* **Container**: MP4
* **Codec**: H.264 video, AAC audio (or muted)
* **Resolution**: 720p (`1280x720`) or 1080p (`1920x1080`)
* **Aspect Ratio**: `16:9`
* **Framerate**: 24 – 30 fps
* **Playback Behavior**: The React frontend automatically sets `autoPlay`, `loop`, `muted`, and `playsInline`.

> **Note**: If `plant-feed.mp4` is not present, the dashboard displays a fallback simulated edge-camera viewfinder with HUD scanning overlays.

---

## 5. End-to-End Python ML Integration Example

Here is a template demonstrating how to capture video frames, run inference, format the JSON contract, throttle transmissions, and send results to RhizoSense:

```python
#!/usr/bin/env python3
"""
RhizoSense Edge Vision Client — Plant Pathology Inference Pipeline
"""

import time
import requests
import cv2  # pip install opencv-python

# Configuration
API_URL = "http://127.0.0.1:8000/api/vision/detection?fieldId=field-c"
VIDEO_SOURCE = "frontend/public/vision/plant-feed.mp4"  # or 0 for USB webcam
CONFIDENCE_THRESHOLD = 0.70  # Detections below 70% are treated as nominal
DISPATCH_INTERVAL_SECONDS = 2.0  # Throttle HTTP requests to 0.5 Hz to avoid network flooding

def run_ml_inference(frame):
    """
    REPLACE THIS FUNCTION WITH YOUR ACTUAL MODEL INFERENCE.
    Examples:
      - YOLOv8: results = model(frame)
      - PyTorch / TorchScript: output = model(tensor)
      - TFLite / Qualcomm SNPE / QNN: interpreter.invoke()
      - ONNX Runtime: session.run(...)
    """
    # STUB: Replace with real model prediction
    # Return: (has_disease: bool, disease_label: str or None, confidence_score: float)
    return True, "Early Blight", 0.91


def main():
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video source: {VIDEO_SOURCE}")
        return

    print("[INFO] Starting RhizoSense Edge Vision Inference Loop...")
    last_dispatch_time = 0.0
    last_sent_detected_state = None

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                # Loop back to beginning for continuous simulation
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            # 1. Run inference on the current frame
            detected, disease, confidence = run_ml_inference(frame)

            # 2. Filter by confidence threshold
            if not detected or confidence < CONFIDENCE_THRESHOLD:
                clean_detected = False
                clean_disease = None
                clean_confidence = round(float(confidence), 2) if confidence else 0.12
            else:
                clean_detected = True
                clean_disease = disease
                clean_confidence = round(float(confidence), 2)

            # 3. Throttle network dispatches
            now = time.time()
            state_changed = (clean_detected != last_sent_detected_state)
            time_elapsed = (now - last_dispatch_time) >= DISPATCH_INTERVAL_SECONDS

            # Send update if state changed OR if throttle interval expired
            if state_changed or time_elapsed:
                payload = {
                    "detected": clean_detected,
                    "disease": clean_disease,
                    "confidence": clean_confidence,
                }

                try:
                    response = requests.post(API_URL, json=payload, timeout=2.0)
                    if response.status_code == 200:
                        status_str = f"DISEASE [{clean_disease} {int(clean_confidence*100)}%]" if clean_detected else "NOMINAL"
                        print(f"[{time.strftime('%H:%M:%S')}] Dispatched -> {status_str}")
                        last_sent_detected_state = clean_detected
                        last_dispatch_time = now
                    else:
                        print(f"[WARN] Server returned HTTP {response.status_code}")
                except Exception as e:
                    print(f"[WARN] Failed to connect to RhizoSense backend: {e}")

            # Optional: Short sleep to reduce CPU usage if reading from file
            time.sleep(0.03)

    except KeyboardInterrupt:
        print("\n[INFO] Edge Vision Pipeline stopped cleanly.")
    finally:
        cap.release()


if __name__ == "__main__":
    main()
```

---

## 6. Recommended Disease Taxonomy

When training or fine-tuning your classifier (e.g. using the PlantVillage dataset or custom greenhouse imagery), standard label mappings include:

| Disease Class | Common Crop | Recommended Action |
| :--- | :--- | :--- |
| **`Early Blight`** | Tomato, Potato | Apply targeted copper fungicide; remove infected lower leaves. |
| **`Late Blight`** | Tomato, Potato | Immediate quarantine; inspect canopy moisture; systemic fungicide. |
| **`Powdery Mildew`** | Cucurbits, Tomato | Increase canopy air circulation; foliar sulfur application. |
| **`Leaf Mold`** | Tomato | Reduce greenhouse relative humidity below 80%. |
| **`Septoria Leaf Spot`** | Tomato | Drip irrigation only; avoid overhead wetting. |
| **`Healthy`** / **`None`** | Any | Nominal maintenance; adequate sunlight and hydration. |

When a healthy plant is detected, set `detected: false` and `disease: null`.

---

## 7. Crucial Rules & Best Practices

1. **Do Not Spam the API on Every Frame**:
   Your model will likely process 15 to 30 frames per second. **Do not** send 30 HTTP POST requests per second to the backend. Throttle transmissions to **1 Hz – 0.5 Hz** (every 1 to 2 seconds) or send only when the detection state changes.
2. **Confidence Range**:
   Always normalize confidence to `0.0 – 1.0` (not `0 – 100`).
3. **Null Values**:
   When `detected: false`, always set `disease: null` (JSON `null` or Python `None`).
4. **Target Field Identification**:
   By default, the camera is bound to `field-c`. If monitoring multiple zones, pass `?fieldId=field-a`, `?fieldId=field-b`, etc. in the query parameter.
5. **Edge Execution (Qualcomm Snapdragon / NPU)**:
   For Snapdragon/Qualcomm edge hardware (e.g. RB5 or Snapdragon Neural Processing SDK / QNN):
   - Export your trained PyTorch/YOLO model to ONNX.
   - Quantize to INT8 or FP16.
   - Convert to Qualcomm `.dlc` format via SNPE tools.
   - Run inference on the Hexagon NPU / DSP.
   - Transmit JSON results to the local or cloud RhizoSense backend via the endpoint above.
