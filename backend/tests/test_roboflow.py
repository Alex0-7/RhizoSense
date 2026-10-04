import os
import pytest
import requests
from unittest.mock import patch, MagicMock

from backend.app.schemas.canonical import (
    VisualEvidence,
    VisualEvidenceType,
    RiskLevel,
    ConfidenceTier,
)
from backend.app.services.roboflow_service import (
    RoboflowService,
    ROBOFLOW_TURMERIC_CLASS_MAP,
    IGNORED_CONTEXT_CLASSES,
)
from backend.app.services.ml_adapter import MLAdapter, InferenceRequest
from backend.app.services.fusion_engine import fusion_engine
from simulator.sensor_source import read_sensors


def test_class_mapping_turmeric():
    """Verify class mapping covers all canonical turmeric diseases."""
    assert "leaf_blotch" in ROBOFLOW_TURMERIC_CLASS_MAP
    assert ROBOFLOW_TURMERIC_CLASS_MAP["leaf_blotch"]["canonical_type"] == VisualEvidenceType.LEAF_SPOTS.value
    assert ROBOFLOW_TURMERIC_CLASS_MAP["leaf_blotch"]["is_disease"] is True

    assert "rhizome_rot" in ROBOFLOW_TURMERIC_CLASS_MAP
    assert ROBOFLOW_TURMERIC_CLASS_MAP["rhizome_rot"]["canonical_type"] == VisualEvidenceType.RHIZOME_DISCOLORATION.value

    assert "dry_leaf" in ROBOFLOW_TURMERIC_CLASS_MAP
    assert ROBOFLOW_TURMERIC_CLASS_MAP["dry_leaf"]["canonical_type"] == VisualEvidenceType.NECROSIS.value

    assert "healthy_leaf" in ROBOFLOW_TURMERIC_CLASS_MAP
    assert ROBOFLOW_TURMERIC_CLASS_MAP["healthy_leaf"]["is_disease"] is False

    # Check non-disease classes are filtered
    assert "leaf" in IGNORED_CONTEXT_CLASSES
    assert "plant" in IGNORED_CONTEXT_CLASSES
    assert "0" in IGNORED_CONTEXT_CLASSES


def test_roboflow_object_detection_parsing():
    """Verify parsing of standard Roboflow bounding box predictions."""
    service = RoboflowService()
    mock_resp = {
        "time": 0.05,
        "image": {"width": 640, "height": 640},
        "predictions": [
            {
                "x": 312.0,
                "y": 240.0,
                "width": 100.0,
                "height": 90.0,
                "confidence": 0.91,
                "class": "leaf_blotch",
            },
            {
                "x": 100.0,
                "y": 100.0,
                "width": 50.0,
                "height": 50.0,
                "confidence": 0.85,
                "class": "leaf",  # should be ignored
            },
        ],
    }

    parsed = service.parse_predictions(mock_resp)
    assert len(parsed) == 1
    assert parsed[0]["condition_name"] == "leaf_blotch"
    assert parsed[0]["canonical_type"] == VisualEvidenceType.LEAF_SPOTS.value
    assert parsed[0]["confidence"] == 0.91
    assert parsed[0]["is_disease"] is True


def test_roboflow_classification_parsing():
    """Verify parsing when Roboflow returns classification format."""
    service = RoboflowService()
    mock_resp = {
        "top": "Rhizome_rot",
        "confidence": 0.88,
        "predictions": {
            "rhizome_rot": 0.88,
            "healthy_leaf": 0.12,
        },
    }

    parsed = service.parse_predictions(mock_resp)
    assert len(parsed) >= 1
    assert any(p["condition_name"] == "rhizome_rot" for p in parsed)


def test_roboflow_no_detections_aggregation():
    """Verify empty/zero detection response aggregates to healthy canopy."""
    service = RoboflowService()
    empty_frames = [[], []]
    evidences = service.aggregate_window_detections(empty_frames, zone_id="B3")

    assert len(evidences) == 1
    assert evidences[0].type == VisualEvidenceType.HEALTHY_CANOPY.value
    assert evidences[0].detected is True
    assert evidences[0].confidence >= 0.70


def test_roboflow_malformed_response():
    """Verify malformed and error responses do not crash the service."""
    service = RoboflowService()
    assert service.parse_predictions({}) == []
    assert service.parse_predictions(None) == []  # type: ignore

    with pytest.raises(RuntimeError):
        service.parse_predictions({"error": "Unauthorized API key"})


def test_roboflow_missing_api_key_graceful_fallback():
    """Verify missing API key triggers graceful fallback without server crash."""
    with patch.dict(os.environ, {"ROBOFLOW_API_KEY": ""}):
        service = RoboflowService()
        assert service.is_configured() is False

        evidences, provider, note, frames = service.process_video_or_frame(
            video_path="non_existent.mp4", zone_id="B3"
        )
        assert provider == "fallback/demo"
        assert evidences == []
        assert "ROBOFLOW_API_KEY is not configured" in (note or "")


def test_roboflow_api_failure_fallback():
    """Verify network/API errors cleanly fall back to fallback/demo."""
    with patch.dict(os.environ, {"ROBOFLOW_API_KEY": "dummy_test_key"}):
        service = RoboflowService()
        with patch.object(service, "infer_image", side_effect=requests.exceptions.ConnectTimeout("Network timeout")):
            evidences, provider, note, frames = service.process_video_or_frame(
                image_base64="data:image/jpeg;base64,/9j/4AAQSkZJRg==", zone_id="B3"
            )
            assert provider == "fallback/demo"
            assert evidences == []
            assert "Network timeout" in (note or "")


def test_deterministic_aggregation_across_frames():
    """
    Simulate the exact scenario from user requirements:
    Frame 1 → leaf_blotch 0.81
    Frame 2 → leaf_blotch 0.87
    Frame 3 → leaf_blotch 0.91
    Frame 4 → healthy_leaf 0.34
    Frame 5 → leaf_blotch 0.89
    => Aggregated visual evidence leaf_blotch with deterministic aggregate.
    """
    service = RoboflowService()
    frames_detections = [
        [{"condition_name": "leaf_blotch", "confidence": 0.81, "is_disease": True, "canonical_type": "leaf_spots", "details": ""}],
        [{"condition_name": "leaf_blotch", "confidence": 0.87, "is_disease": True, "canonical_type": "leaf_spots", "details": ""}],
        [{"condition_name": "leaf_blotch", "confidence": 0.91, "is_disease": True, "canonical_type": "leaf_spots", "details": ""}],
        [{"condition_name": "healthy", "confidence": 0.34, "is_disease": False, "canonical_type": "healthy_canopy", "details": ""}],
        [{"condition_name": "leaf_blotch", "confidence": 0.89, "is_disease": True, "canonical_type": "leaf_spots", "details": ""}],
    ]

    evidences = service.aggregate_window_detections(frames_detections, zone_id="B3")
    assert len(evidences) >= 1

    primary = next((e for e in evidences if e.type == VisualEvidenceType.LEAF_SPOTS.value), None)
    assert primary is not None
    assert primary.detected is True
    # Average of 0.81, 0.87, 0.91, 0.89 = 0.87
    assert round(primary.confidence, 2) == 0.87
    assert "roboflow" in primary.source.lower()


def test_ml_adapter_with_mocked_roboflow():
    """Verify MLAdapter integration when Roboflow is enabled and returns detection."""
    adapter = MLAdapter()

    fake_parsed = [
        [{"condition_name": "leaf_blotch", "confidence": 0.92, "is_disease": True, "canonical_type": "leaf_spots", "details": ""}]
    ]

    with patch.dict(os.environ, {"ROBOFLOW_API_KEY": "test_key"}):
        with patch("backend.app.services.ml_adapter.roboflow_service.process_video_or_frame") as mock_proc:
            mock_proc.return_value = (
                [
                    VisualEvidence(
                        type=VisualEvidenceType.LEAF_SPOTS.value,
                        detected=True,
                        confidence=0.92,
                        source="roboflow:turmeric-final-tmips/1",
                        details="Turmeric leaf blotch detected.",
                    )
                ],
                "roboflow",
                "Successfully evaluated 3 frames via Roboflow.",
                3,
            )

            req = InferenceRequest(zone_id="B3", use_roboflow=True)
            outcome = adapter.run_inference_detailed(req)

            assert outcome.provider == "roboflow"
            assert outcome.frames_processed == 3
            assert len(outcome.evidences) == 1
            assert outcome.evidences[0].type == VisualEvidenceType.LEAF_SPOTS.value


def test_roboflow_fusion_with_simulated_sensors():
    """
    Verify combining Roboflow visual evidence with simulated sensor readings
    through multimodal fusion engine to produce canonical DiagnosisResult.
    """
    # 1. Simulated sensor telemetry for Zone B3
    sensor_readings = read_sensors(zone_id="B3", scenario_name="drought", tick=2)
    assert len(sensor_readings) >= 3

    # 2. Roboflow visual evidence (turmeric leaf blotch)
    visual_evidences = [
        VisualEvidence(
            type=VisualEvidenceType.LEAF_SPOTS.value,
            detected=True,
            confidence=0.89,
            source="roboflow:turmeric-final-tmips/1",
            details="Turmeric leaf blotch lesions detected.",
        )
    ]

    # 3. Multimodal Fusion
    diag = fusion_engine.fuse_zone_evidence(
        zone_id="B3",
        sensor_readings=sensor_readings,
        visual_evidence=visual_evidences,
        crop="Turmeric",
    )

    assert diag.zone_id == "B3"
    assert diag.diagnosis.condition == "leaf_blotch"
    assert diag.diagnosis.risk_level in [RiskLevel.ATTENTION, RiskLevel.ACTION_REQUIRED]
    assert "Mancozeb" in diag.recommendation.action or "fungicide" in diag.recommendation.action.lower()
    assert "ta" in diag.recommendation.voice_text
    assert "hi" in diag.recommendation.voice_text
