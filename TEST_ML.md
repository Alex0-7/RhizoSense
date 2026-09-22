# RhizoSense — Edge Vision & ML Integration Testing Guide

This guide is for testing, verifying, and validating the **Edge Vision & Plant Pathology** integration in **RhizoSense**. Follow these steps to verify that detection results flow properly from the ML pipeline into the backend and render in real time on the dashboard.

---

## 1. Quick In-Browser Interactive Test (Zero Code)

The easiest way to test the integration is directly within the dashboard UI:

1. Start your local environment (or open your deployed Vercel dashboard):
   - Navigate to: **`http://localhost:5173/fields/field-c`** (or `https://<your-project>.vercel.app/fields/field-c`).
2. Scroll to the **Edge Vision & Plant Pathology** panel.
3. Observe the current state:
   - **Warning Card**: Displays `"Early Blight detected"`, `Confidence: 91%`, and a warning badge.
   - **Viewfinder HUD**: Shows `"● LIVE"`, `"CAM-01 · FIELD C CANOPY"`, and an orange bounding box around the suspected foliage.
4. Click the button: **`Simulate Clear Canopy`**:
   - The card transitions to green **Nominal** (`"No disease detected"`, `Confidence: 12%`).
   - The bounding box disappears from the camera feed.
5. Click the button: **`Simulate Disease (Early Blight)`**:
   - The card transitions from `false` → `true`.
   - **A warning toast notification pops up** in the bottom-right corner:
     ```text
     [Warning] Early Blight detected in Field C
     Edge vision model detected Early Blight with 91% confidence.
     ```
   - The notification is logged permanently in the **Notification Center** (`/notifications`).
   - Clicking the button repeatedly in the same state **does not spam duplicate notifications**.

---

## 2. Testing via Terminal Commands (cURL / PowerShell)

Use standard HTTP POST commands to send simulated CV model outputs to the backend.

### A. Test Against Local Backend (`http://127.0.0.1:8000`)

#### 1. Simulate Clear Canopy (No Disease)
```bash
curl -X POST "http://127.0.0.1:8000/api/vision/detection?fieldId=field-c" \
     -H "Content-Type: application/json" \
     -d '{"detected": false, "disease": null, "confidence": 0.12}'
```
**Expected Response**:
```json
{
  "detected": false,
  "disease": null,
  "confidence": 0.12
}
```

#### 2. Simulate Disease Detected (Early Blight)
```bash
curl -X POST "http://127.0.0.1:8000/api/vision/detection?fieldId=field-c" \
     -H "Content-Type: application/json" \
     -d '{"detected": true, "disease": "Early Blight", "confidence": 0.91}'
```
**Expected Response**:
```json
{
  "detected": true,
  "disease": "Early Blight",
  "confidence": 0.91
}
```
* **Result in Browser**: The Field Detail page immediately updates to the warning state, and a warning toast appears.

#### 3. Query the Current Stored Detection State
```bash
curl -X GET "http://127.0.0.1:8000/api/vision/detection?fieldId=field-c"
```

---

### B. Test Against Cloud Deployment (Render Backend)

Replace `https://rhizosense-backend.onrender.com` with your actual Render service URL:

```bash
# 1. Send disease detection to cloud backend
curl -X POST "https://rhizosense-backend.onrender.com/api/vision/detection?fieldId=field-c" \
     -H "Content-Type: application/json" \
     -d '{"detected": true, "disease": "Early Blight", "confidence": 0.91}'

# 2. Check live Vercel dashboard at https://<your-project>.vercel.app/fields/field-c
```

---

### C. Using PowerShell (Windows)

If testing in Windows PowerShell:

```powershell
# Disease Detected
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/vision/detection?fieldId=field-c" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"detected": true, "disease": "Early Blight", "confidence": 0.91}'

# Clear Canopy
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/vision/detection?fieldId=field-c" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"detected": false, "disease": null, "confidence": 0.12}'
```

---

## 3. Automated Python Test Script

You can save and run this automated verification script:

```python
#!/usr/bin/env python3
"""
RhizoSense — Automated ML Integration Test Script
"""

import requests
import sys

BASE_URL = "http://127.0.0.1:8000"  # or your Render cloud URL

def test_ml_integration():
    print("=" * 60)
    print("RHIZOSENSE ML INTEGRATION VERIFICATION")
    print("=" * 60)

    # 1. Check health
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=3.0)
        assert r.status_code == 200, f"Health check failed with HTTP {r.status_code}"
        print("[✓] Backend is online and healthy.")
    except Exception as e:
        print(f"[FAIL] Could not connect to {BASE_URL}: {e}")
        sys.exit(1)

    # 2. Reset baseline
    requests.post(f"{BASE_URL}/api/simulator/reset", timeout=3.0)
    print("[✓] Farm state reset to baseline.")

    # 3. Send Clear Canopy (detected = false)
    nominal_payload = {
        "detected": False,
        "disease": None,
        "confidence": 0.12,
    }
    r_nom = requests.post(f"{BASE_URL}/api/vision/detection?fieldId=field-c", json=nominal_payload)
    assert r_nom.status_code == 200
    assert r_nom.json()["detected"] is False
    print("[✓] Set nominal state: detected=false, confidence=12%.")

    # 4. Count notifications before disease detection
    notifs_before = requests.get(f"{BASE_URL}/api/notifications?fieldId=field-c").json()["total"]

    # 5. Send Disease Detection (detected = true) — Transition false -> true
    disease_payload = {
        "detected": True,
        "disease": "Early Blight",
        "confidence": 0.91,
    }
    r_dis = requests.post(f"{BASE_URL}/api/vision/detection?fieldId=field-c", json=disease_payload)
    assert r_dis.status_code == 200
    assert r_dis.json()["detected"] is True
    assert r_dis.json()["disease"] == "Early Blight"
    assert r_dis.json()["confidence"] == 0.91
    print("[✓] Set disease state: Early Blight, confidence=91%.")

    # 6. Verify exactly ONE warning notification was created
    notifs_after = requests.get(f"{BASE_URL}/api/notifications?fieldId=field-c").json()
    assert notifs_after["total"] == notifs_before + 1, "Notification count did not increase by exactly 1"
    latest_notif = notifs_after["notifications"][0]
    assert latest_notif["severity"] == "warning"
    assert "Early Blight" in latest_notif["title"]
    print(f"[✓] Verified single warning notification generated: '{latest_notif['title']}'.")

    # 7. Send the same disease state again (duplicate) — Must NOT create another notification
    requests.post(f"{BASE_URL}/api/vision/detection?fieldId=field-c", json=disease_payload)
    notifs_duplicate = requests.get(f"{BASE_URL}/api/notifications?fieldId=field-c").json()["total"]
    assert notifs_duplicate == notifs_after["total"], "Duplicate notification was erroneously created!"
    print("[✓] Anti-spam verified: No duplicate notification on repeated true state.")

    print("=" * 60)
    print("ALL ML INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    test_ml_integration()
```

---

## 4. Verification Checklist

Before approving an ML model integration, check off these 7 validation criteria:

- [ ] **Exact JSON Structure**: Payload contains only `detected` (bool), `disease` (str/null), and `confidence` (float 0.0–1.0).
- [ ] **Nominal State Display**: When `detected: false`, card displays green `"No disease detected"` with baseline confidence (e.g., `12%`).
- [ ] **Disease State Display**: When `detected: true`, card displays warning `"Early Blight detected"` with confidence percentage (`91%`).
- [ ] **Live Viewfinder Bounding Box**: When disease is detected, an orange target box highlights suspected foliage with `[EARLY BLIGHT - 91%]`.
- [ ] **Single Toast Warning**: When transitioning from nominal to disease, a single warning toast appears in the bottom-right corner.
- [ ] **Anti-Spam Rate Limiting**: Repeated updates with the same detection status do not spam toasts or crash the browser.
- [ ] **Video Playback**: Placing `plant-feed.mp4` in `frontend/public/vision/` autoplays, loops continuously, and stays muted.

---

## 5. Troubleshooting Common Issues

| Issue | Likely Cause | Solution |
| :--- | :--- | :--- |
| **HTTP 404 on `POST /api/vision/detection`** | Missing `/api` prefix in URL. | Ensure the endpoint path is `/api/vision/detection` (not `/vision/detection`). |
| **Notification doesn't appear** | Detection was already `true` before sending. | Notifications only fire on `false` → `true` transition. Send `detected: false` first, then send `detected: true`. |
| **CORS error in browser console** | Backend CORS origin not configured. | Set `CORS_ORIGINS=*` or include your Vercel domain in Render environment variables. |
| **Video shows dark animated fallback** | `plant-feed.mp4` file is not in `frontend/public/vision/`. | Place an MP4 video file named `plant-feed.mp4` in `frontend/public/vision/`. |
| **Confidence shows decimals instead of percent** | Model sending integer `91` instead of `0.91`. | The dashboard multiplies by 100. Send `0.91` for 91%. |
