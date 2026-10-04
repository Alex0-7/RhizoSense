import pytest
from backend.app.schemas.canonical import VisualEvidence
from backend.app.services.ml_adapter import ml_adapter, InferenceRequest


def test_ml_adapter_demo_zone_b3():
    req = InferenceRequest(zone_id="B3")
    evidences = ml_adapter.run_inference(req)
    assert len(evidences) >= 1
    types = [e.type for e in evidences]
    assert "wilting" in types
    assert evidences[0].confidence >= 0.80
    assert evidences[0].detected is True


def test_ml_adapter_healthy_zone():
    req = InferenceRequest(zone_id="A1")
    evidences = ml_adapter.run_inference(req)
    assert len(evidences) == 1
    assert evidences[0].type == "healthy_canopy"
    assert evidences[0].confidence >= 0.90


def test_ml_adapter_video_source():
    req = InferenceRequest(zone_id="C4", video_source="early_blight_sample.mp4")
    evidences = ml_adapter.run_inference(req)
    types = [e.type for e in evidences]
    assert "leaf_spots" in types
    assert evidences[0].source == "prerecorded_video_adapter"


def test_ml_adapter_override():
    req = InferenceRequest(zone_id="E2", condition_override="rhizome_rot")
    evidences = ml_adapter.run_inference(req)
    types = [e.type for e in evidences]
    assert "rhizome_discoloration" in types
