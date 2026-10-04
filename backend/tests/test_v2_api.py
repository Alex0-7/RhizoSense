import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_list_zones_endpoint():
    res = client.get("/api/zones")
    assert res.status_code == 200
    zones = res.json()
    assert len(zones) == 25
    b3 = next((z for z in zones if z["zone_id"] == "B3"), None)
    assert b3 is not None
    assert b3["row"] == 2
    assert b3["column"] == 3
    assert b3["grid_size_m"] == 5


def test_get_zone_detail():
    res = client.get("/api/zones/B3")
    assert res.status_code == 200
    data = res.json()
    assert data["zone_id"] == "B3"
    assert data["crop"] == "Tomato"


def test_get_zone_diagnosis():
    res = client.get("/api/diagnosis/B3")
    assert res.status_code == 200
    data = res.json()
    assert data["zone_id"] == "B3"
    assert "diagnosis" in data
    assert "condition" in data["diagnosis"]
    assert "risk_level" in data["diagnosis"]
    assert "recommendation" in data
    assert "voice_text" in data["recommendation"]


def test_sensor_ingestion_endpoint():
    payload = [
        {
            "zone_id": "B3",
            "metric": "soil_moisture",
            "value": 15.2,
            "unit": "%",
            "timestamp": "2026-09-23T12:00:00Z",
            "source": "sensor",
        },
        {
            "zone_id": "B3",
            "metric": "soil_temperature",
            "value": 36.5,
            "unit": "°C",
            "timestamp": "2026-09-23T12:00:00Z",
            "source": "sensor",
        },
    ]
    res = client.post("/api/sensors/readings", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ingested"
    assert data["zone_id"] == "B3"
    assert data["risk_level"] == "ACTION_REQUIRED"

    # Confirm diagnosis endpoint returns updated state
    diag_res = client.get("/api/diagnosis/B3")
    assert diag_res.status_code == 200
    diag = diag_res.json()
    assert diag["diagnosis"]["risk_level"] == "ACTION_REQUIRED"


def test_vision_infer_endpoint():
    req = {
        "zone_id": "B3",
        "video_source": "rhizome_rot_canopy.mp4",
        "condition_override": "rhizome_rot",
    }
    res = client.post("/api/vision/infer", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["zone_id"] == "B3"
    assert len(data["visual_evidence"]) >= 1
    assert data["visual_evidence"][0]["detected"] is True
    assert data["diagnosis"]["diagnosis"]["risk_level"] in ["ACTION_REQUIRED", "ATTENTION"]


def test_sync_endpoint():
    records = [
        {
            "local_id": "sync-test-001",
            "event_type": "farmer_ack",
            "timestamp": "2026-09-23T12:00:00Z",
            "payload": {"zone_id": "B3", "action": "applied_mulch"},
            "sync_status": "PENDING",
            "retry_count": 0,
        }
    ]
    res = client.post("/api/sync", json=records)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "synchronized"
    assert data["records_processed"] == 1


def test_action_acknowledge_endpoint():
    payload = {
        "zone_id": "B3",
        "action_taken": "drip_irrigation_initiated",
        "notes": "Delivered 15 L/sq.m as recommended",
    }
    res = client.post("/api/actions/acknowledge", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "acknowledged"
    assert res.json()["zone_id"] == "B3"


def test_read_sensors_endpoint():
    payload = {
        "zone_id": "B3",
        "scenario": "drought",
        "tick": 20,
    }
    res = client.post("/api/simulator/read-sensors", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "read_sensors_ingested"
    assert data["zone_id"] == "B3"
    assert data["readings_count"] == 5
    assert "diagnosis" in data
    assert data["diagnosis"]["diagnosis"]["risk_level"] in ["ACTION_REQUIRED", "ATTENTION"]


def test_vision_config_endpoint():
    res = client.get("/api/vision/config")
    assert res.status_code == 200
    data = res.json()
    assert "provider" in data
    assert "video_asset_path" in data
    assert "hardware_target" in data


