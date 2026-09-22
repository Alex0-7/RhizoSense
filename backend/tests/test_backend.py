import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.schemas.enums import Status
from backend.app.services.rules_engine import evaluate_field_condition

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


def test_farm_summary_endpoint():
    response = client.get("/api/farm")
    assert response.status_code == 200
    data = response.json()
    assert data["farm"]["name"] == "Demo Farm"
    assert data["farm"]["fieldCount"] == 6
    assert len(data["fields"]) == 6
    assert "environmental" in data
    assert "edgeSystem" in data


def test_field_detail_endpoint():
    response = client.get("/api/fields/field-c")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "field-c"
    assert data["crop"] == "Tomato"
    assert "cropHealth" in data
    assert "water" in data
    assert "recommendation" in data


def test_analytics_endpoint():
    response = client.get("/api/analytics?fieldId=field-c&metrics=soil_moisture,temperature&period=24h")
    assert response.status_code == 200
    data = response.json()
    assert len(data["series"]) == 2
    assert data["series"][0]["fieldId"] == "field-c"
    assert len(data["series"][0]["points"]) > 0


def test_rules_engine_drought_progression():
    # 1. Normal moisture
    status, health, env, water, risk, ai_ass, rec, notif = evaluate_field_condition(
        field_id="field-c",
        farm_id="farm-demo",
        soil_moisture=50.0,
        temperature=28.0,
        humidity=60.0,
    )
    assert status == Status.NORMAL
    assert water.irrigation_needed is False

    # 2. Warning moisture (25%)
    status, health, env, water, risk, ai_ass, rec, notif = evaluate_field_condition(
        field_id="field-c",
        farm_id="farm-demo",
        soil_moisture=25.0,
        temperature=33.0,
        humidity=45.0,
        previous_status=Status.NORMAL,
    )
    assert status == Status.WARNING
    assert water.irrigation_needed is True
    assert notif is not None
    assert notif.severity.value == "warning"

    # 3. Critical moisture (17%)
    status, health, env, water, risk, ai_ass, rec, notif = evaluate_field_condition(
        field_id="field-c",
        farm_id="farm-demo",
        soil_moisture=17.0,
        temperature=37.0,
        humidity=38.0,
        previous_status=Status.WARNING,
    )
    assert status == Status.CRITICAL
    assert water.irrigation_needed is True
    assert notif is not None
    assert notif.severity.value == "critical"
    assert "Irrigate" in rec.action


def test_simulator_telemetry_endpoint():
    payload = {
        "field_id": "field-c",
        "soil_moisture": 18.2,
        "temperature": 36.4,
        "humidity": 41.0,
        "rainfall_mm": 0.0,
        "pest_level": 10.0,
    }
    response = client.post("/api/simulator/telemetry", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "received"
    assert data["fieldId"] == "field-c"
    assert data["fieldStatus"] == "critical"

    # Verify field is now critical in GET /api/fields/field-c
    get_res = client.get("/api/fields/field-c")
    assert get_res.json()["status"] == "critical"
    assert get_res.json()["water"]["soilMoisturePercent"] == 18.2
