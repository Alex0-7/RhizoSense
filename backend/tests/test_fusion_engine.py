import pytest
from backend.app.schemas.canonical import (
    SensorReading,
    VisualEvidence,
    RiskLevel,
    ConfidenceTier,
)
from backend.app.services.fusion_engine import fusion_engine


def test_fusion_normal_scenario():
    sensors = [
        SensorReading(zone_id="A1", metric="soil_moisture", value=52.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="A1", metric="temperature", value=28.5, unit="°C", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="A1", metric="humidity", value=60.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="A1", metric="pest_level", value=8.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
    ]
    result = fusion_engine.fuse_zone_evidence(zone_id="A1", sensor_readings=sensors)
    assert result.zone_id == "A1"
    assert result.diagnosis.risk_level == RiskLevel.HEALTHY
    assert result.diagnosis.condition == "healthy_crop"
    assert result.diagnosis.confidence == ConfidenceTier.HIGH
    assert "Maintain regular" in result.recommendation.action
    assert "ta" in result.recommendation.voice_text
    assert "hi" in result.recommendation.voice_text
    assert "en" in result.recommendation.voice_text


def test_fusion_drought_scenario():
    sensors = [
        SensorReading(zone_id="B3", metric="soil_moisture", value=16.5, unit="%", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="B3", metric="temperature", value=34.0, unit="°C", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="B3", metric="humidity", value=42.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
    ]
    result = fusion_engine.fuse_zone_evidence(zone_id="B3", sensor_readings=sensors)
    assert result.zone_id == "B3"
    assert result.diagnosis.risk_level == RiskLevel.ACTION_REQUIRED
    assert result.diagnosis.condition == "critical_drought_stress"
    assert "drip" in result.recommendation.action.lower()


def test_fusion_heat_scenario():
    sensors = [
        SensorReading(zone_id="C2", metric="soil_moisture", value=44.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="C2", metric="temperature", value=41.2, unit="°C", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="C2", metric="humidity", value=45.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
    ]
    result = fusion_engine.fuse_zone_evidence(zone_id="C2", sensor_readings=sensors)
    assert result.zone_id == "C2"
    assert result.diagnosis.risk_level == RiskLevel.ACTION_REQUIRED
    assert result.diagnosis.condition == "extreme_heat_stress"
    assert "shade" in result.recommendation.action.lower() or "sprinkler" in result.recommendation.action.lower()


def test_fusion_pest_scenario():
    sensors = [
        SensorReading(zone_id="D4", metric="soil_moisture", value=48.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="D4", metric="temperature", value=29.0, unit="°C", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="D4", metric="humidity", value=62.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="D4", metric="pest_level", value=78.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
    ]
    result = fusion_engine.fuse_zone_evidence(zone_id="D4", sensor_readings=sensors)
    assert result.zone_id == "D4"
    assert result.diagnosis.risk_level == RiskLevel.ACTION_REQUIRED
    assert result.diagnosis.condition == "pest_infestation"
    assert "pesticide" in result.recommendation.action.lower()


def test_fusion_multimodal_rhizome_rot():
    # Visual wilting + Saturated soil + high humidity
    sensors = [
        SensorReading(zone_id="B3", metric="soil_moisture", value=88.5, unit="%", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="B3", metric="temperature", value=27.5, unit="°C", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="B3", metric="humidity", value=84.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
    ]
    visuals = [
        VisualEvidence(type="wilting", detected=True, confidence=0.88, source="vision"),
        VisualEvidence(type="rhizome_discoloration", detected=True, confidence=0.76, source="vision"),
    ]
    result = fusion_engine.fuse_zone_evidence(
        zone_id="B3",
        sensor_readings=sensors,
        visual_evidence=visuals,
    )
    assert result.zone_id == "B3"
    assert result.diagnosis.condition == "rhizome_rot"
    assert result.diagnosis.risk_level == RiskLevel.ACTION_REQUIRED
    assert result.diagnosis.confidence == ConfidenceTier.HIGH
    assert result.environmental_match.matched is True
    assert "irrigation" in result.recommendation.action.lower()
    assert "Halt" in result.recommendation.action


def test_fusion_determinism():
    sensors = [
        SensorReading(zone_id="E5", metric="soil_moisture", value=26.0, unit="%", timestamp="2026-09-23T12:00:00Z"),
        SensorReading(zone_id="E5", metric="temperature", value=31.0, unit="°C", timestamp="2026-09-23T12:00:00Z"),
    ]
    res1 = fusion_engine.fuse_zone_evidence("E5", sensors)
    res2 = fusion_engine.fuse_zone_evidence("E5", sensors)
    assert res1.diagnosis.condition == res2.diagnosis.condition
    assert res1.diagnosis.risk_level == res2.diagnosis.risk_level
    assert res1.diagnosis.confidence == res2.diagnosis.confidence
    assert res1.recommendation.action == res2.recommendation.action
