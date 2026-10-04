import pytest
from backend.app.schemas.canonical import (
    Zone,
    VisualEvidence,
    SensorReading,
    EnvironmentalMatch,
    Advisory,
    DiagnosisCore,
    DiagnosisResult,
    RiskLevel,
    ConfidenceTier,
    SyncRecord,
    SyncStatus,
    status_to_risk_level,
    risk_level_to_status_str,
    confidence_float_to_tier,
    tier_to_confidence_float,
)


def test_zone_contract():
    data = {
        "zone_id": "B3",
        "row": 2,
        "column": 3,
        "grid_size_m": 5,
    }
    zone = Zone(**data)
    assert zone.zone_id == "B3"
    assert zone.row == 2
    assert zone.column == 3
    assert zone.grid_size_m == 5
    assert zone.current_risk == RiskLevel.HEALTHY
    dumped = zone.model_dump()
    assert dumped["zone_id"] == "B3"
    assert dumped["grid_size_m"] == 5


def test_visual_evidence_contract():
    data = {
        "type": "wilting",
        "detected": True,
        "confidence": 0.91,
        "source": "vision",
    }
    evidence = VisualEvidence(**data)
    assert evidence.type == "wilting"
    assert evidence.detected is True
    assert evidence.confidence == 0.91
    assert evidence.source == "vision"


def test_sensor_reading_contract():
    data = {
        "zone_id": "B3",
        "metric": "soil_moisture",
        "value": 89.0,
        "unit": "%FC",
        "timestamp": "2026-09-23T12:00:00Z",
        "source": "sensor",
    }
    reading = SensorReading(**data)
    assert reading.zone_id == "B3"
    assert reading.metric == "soil_moisture"
    assert reading.value == 89.0
    assert reading.unit == "%FC"
    assert reading.timestamp == "2026-09-23T12:00:00Z"


def test_diagnosis_result_contract():
    raw = {
        "zone_id": "B3",
        "timestamp": "2026-09-23T12:00:00Z",
        "diagnosis": {
            "condition": "rhizome_rot",
            "confidence": "HIGH",
            "risk_level": "ACTION_REQUIRED",
        },
        "visual_evidence": [
            {
                "type": "wilting",
                "detected": True,
                "confidence": 0.91,
                "source": "vision",
            }
        ],
        "sensor_evidence": [
            {
                "zone_id": "B3",
                "metric": "soil_moisture",
                "value": 89.0,
                "unit": "%FC",
                "timestamp": "2026-09-23T12:00:00Z",
                "source": "sensor",
            }
        ],
        "environmental_match": {
            "matched": True,
            "reason": "Conditions match the configured risk window.",
        },
        "recommendation": {
            "action": "inspect_zone",
            "secondary_action": "avoid_unnecessary_irrigation",
            "urgency": "ACTION_REQUIRED",
            "reason": "Root zone saturation and foliar necrosis observed.",
            "voice_text": {
                "en": "Action required in Zone B3. Inspect zone immediately and halt irrigation.",
                "ta": "மண்டலம் B3 இல் நடவடிக்கை தேவை. உடனடியாக சோதித்து பாசனத்தை நிறுத்தவும்.",
                "hi": "जोन B3 में तत्काल कार्रवाई की आवश्यकता है। सिंचाई तुरंत रोकें।",
            },
        },
    }
    result = DiagnosisResult(**raw)
    assert result.zone_id == "B3"
    assert result.diagnosis.condition == "rhizome_rot"
    assert result.diagnosis.confidence == ConfidenceTier.HIGH
    assert result.diagnosis.risk_level == RiskLevel.ACTION_REQUIRED
    assert len(result.visual_evidence) == 1
    assert len(result.sensor_evidence) == 1
    assert result.environmental_match.matched is True
    assert result.recommendation.action == "inspect_zone"
    assert result.recommendation.voice_text["en"].startswith("Action required")


def test_sync_record_contract():
    record = SyncRecord(
        local_id="sync-001",
        event_type="farmer_ack",
        timestamp="2026-09-23T12:00:00Z",
        payload={"zone_id": "B3", "action": "acknowledged"},
        sync_status=SyncStatus.PENDING,
    )
    assert record.local_id == "sync-001"
    assert record.sync_status == SyncStatus.PENDING
    assert record.retry_count == 0


def test_conversion_helpers():
    assert status_to_risk_level("critical") == RiskLevel.ACTION_REQUIRED
    assert status_to_risk_level("warning") == RiskLevel.ATTENTION
    assert status_to_risk_level("advisory") == RiskLevel.MONITOR
    assert status_to_risk_level("normal") == RiskLevel.HEALTHY

    assert risk_level_to_status_str(RiskLevel.ACTION_REQUIRED) == "critical"
    assert risk_level_to_status_str(RiskLevel.ATTENTION) == "warning"
    assert risk_level_to_status_str(RiskLevel.MONITOR) == "advisory"
    assert risk_level_to_status_str(RiskLevel.HEALTHY) == "normal"

    assert confidence_float_to_tier(0.95) == ConfidenceTier.HIGH
    assert confidence_float_to_tier(0.70) == ConfidenceTier.MEDIUM
    assert confidence_float_to_tier(0.30) == ConfidenceTier.LOW

    assert tier_to_confidence_float(ConfidenceTier.HIGH) == 0.91
    assert tier_to_confidence_float(ConfidenceTier.MEDIUM) == 0.72
    assert tier_to_confidence_float(ConfidenceTier.LOW) == 0.40
