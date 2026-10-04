from __future__ import annotations
import os
import logging
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.app.schemas.canonical import (
    VisualEvidence,
    VisualEvidenceType,
)
from backend.app.services.roboflow_service import roboflow_service

logger = logging.getLogger("rhizosense.ml_adapter")


class MLProviderType(str, Enum):
    DEMO = "demo"
    PRERECORDED_VIDEO = "prerecorded_video"
    REAL_ML = "real_ml"
    ROBOFLOW = "roboflow"
    FALLBACK_DEMO = "fallback/demo"


class MLConfig(BaseModel):
    provider: str = "demo"
    video_asset_path: str = "frontend/public/vision/plant-feed.mp4"
    video_asset_exists: bool = False
    model_path: Optional[str] = None
    model_loaded: bool = False
    hardware_target: str = "Edge NPU / Host Simulator"
    roboflow_configured: bool = False
    roboflow_model_id: str = "turmeric-final-tmips/1"
    roboflow_api_url: str = "https://serverless.roboflow.com"
    roboflow_frame_fps: float = 2.0


class InferenceRequest(BaseModel):
    zone_id: str = Field(..., description="Target zone for inference, e.g. 'B3'")
    image_base64: Optional[str] = Field(None, description="Captured base64-encoded frame/image")
    video_source: Optional[str] = Field(None, description="Pre-recorded demo video identifier")
    frame_index: int = Field(default=0, description="Extracted frame sequence index")
    condition_override: Optional[str] = Field(None, description="Optional deterministic test/demo override")
    use_roboflow: Optional[bool] = Field(None, description="Explicit flag to invoke Roboflow inference")
    sample_fps: Optional[float] = Field(None, description="Configurable FPS for video frame sampling (1-3 FPS)")


class MLInferenceOutcome(BaseModel):
    evidences: List[VisualEvidence]
    provider: str = "demo"
    provider_note: Optional[str] = None
    frames_processed: int = 1


class MLAdapter:
    """
    Standardized ML Adapter adhering to docs/04_ML_INTERFACE.md.
    Normalizes video/frame/image inputs into canonical VisualEvidence records.
    Provides Roboflow turmeric model inference with configurable frame sampling,
    graceful fallback, and deterministic demo logic for SIH 2026 scenarios.
    """

    def __init__(self):
        prov_env = os.getenv("RHIZOSENSE_ML_PROVIDER", "").lower().strip()
        if prov_env in ["roboflow"]:
            self.provider = MLProviderType.ROBOFLOW
        elif prov_env in ["real_ml", "tensorrt", "pytorch"]:
            self.provider = MLProviderType.REAL_ML
        elif prov_env in ["prerecorded", "video"]:
            self.provider = MLProviderType.PRERECORDED_VIDEO
        elif roboflow_service.is_configured():
            self.provider = MLProviderType.ROBOFLOW
        else:
            self.provider = MLProviderType.DEMO

        self.video_asset_path = os.getenv("RHIZOSENSE_VIDEO_PATH", "frontend/public/vision/plant-feed.mp4")
        self.model_path = os.getenv("RHIZOSENSE_MODEL_PATH", None)

    def get_config(self) -> MLConfig:
        video_exists = os.path.exists(self.video_asset_path)
        model_exists = bool(self.model_path and os.path.exists(self.model_path))
        roboflow_ready = roboflow_service.is_configured()

        active_provider_name = (
            MLProviderType.ROBOFLOW.value
            if (self.provider == MLProviderType.ROBOFLOW and roboflow_ready)
            else (MLProviderType.FALLBACK_DEMO.value if self.provider == MLProviderType.ROBOFLOW else self.provider.value)
        )

        return MLConfig(
            provider=active_provider_name,
            video_asset_path=self.video_asset_path,
            video_asset_exists=video_exists,
            model_path=self.model_path,
            model_loaded=model_exists or roboflow_ready,
            hardware_target="Roboflow Serverless API (turmeric-final-tmips/1)" if roboflow_ready else "Edge NPU / Host Simulator",
            roboflow_configured=roboflow_ready,
            roboflow_model_id=roboflow_service.model_id,
            roboflow_api_url=roboflow_service.api_url,
            roboflow_frame_fps=roboflow_service.frame_fps,
        )

    def run_inference_detailed(self, request: InferenceRequest) -> MLInferenceOutcome:
        """
        Executes inference and returns full outcome metadata (evidences, provider, provider_note, frames_processed).
        """
        zone_id = request.zone_id.upper()
        target_override = request.condition_override

        # 1. Check if Roboflow inference should be run
        should_use_roboflow = (
            request.use_roboflow is True
            or (request.use_roboflow is not False and self.provider == MLProviderType.ROBOFLOW)
            or (request.use_roboflow is not False and roboflow_service.is_configured())
        )

        if should_use_roboflow and not target_override:
            # Resolve video path if requested or default
            video_path = None
            if request.video_source:
                candidate = request.video_source
                if os.path.exists(candidate):
                    video_path = candidate
                elif os.path.exists(os.path.join("frontend/public/vision", candidate)):
                    video_path = os.path.join("frontend/public/vision", candidate)
                elif os.path.exists(self.video_asset_path):
                    video_path = self.video_asset_path
            elif os.path.exists(self.video_asset_path):
                video_path = self.video_asset_path

            # Attempt Roboflow processing
            evidences, provider_label, provider_note, frames_count = roboflow_service.process_video_or_frame(
                video_path=video_path,
                image_base64=request.image_base64,
                zone_id=zone_id,
                fps=request.sample_fps,
            )

            if evidences and provider_label == "roboflow":
                return MLInferenceOutcome(
                    evidences=evidences,
                    provider="roboflow",
                    provider_note=provider_note,
                    frames_processed=frames_count,
                )
            else:
                logger.info(f"Roboflow not activated or returned empty ({provider_note}). Using deterministic fallback.")
                fallback_evidences = self._generate_deterministic_evidences(zone_id, request.video_source, target_override)
                return MLInferenceOutcome(
                    evidences=fallback_evidences,
                    provider="fallback/demo",
                    provider_note=provider_note or "Roboflow API unavailable; executed deterministic fallback inference.",
                    frames_processed=max(1, frames_count),
                )

        # 2. Pure deterministic demo mode
        evidences = self._generate_deterministic_evidences(zone_id, request.video_source, target_override)
        return MLInferenceOutcome(
            evidences=evidences,
            provider="demo",
            provider_note="Deterministic Edge ML Provider (SIH 2026 baseline scenario)",
            frames_processed=1,
        )

    def run_inference(self, request: InferenceRequest) -> List[VisualEvidence]:
        """
        Backwards-compatible interface returning canonical VisualEvidence list.
        """
        outcome = self.run_inference_detailed(request)
        return outcome.evidences

    def _generate_deterministic_evidences(
        self, zone_id: str, video_source: Optional[str], target_override: Optional[str]
    ) -> List[VisualEvidence]:
        target_condition = target_override

        # If video_source specified, infer from video preset
        if not target_condition and video_source:
            v_lower = video_source.lower()
            if "rhizome" in v_lower or "rot" in v_lower or "wilt" in v_lower:
                target_condition = "rhizome_rot"
            elif "blotch" in v_lower:
                target_condition = "leaf_blotch"
            elif "blight" in v_lower or "spot" in v_lower:
                target_condition = "early_blight"
            elif "healthy" in v_lower or "nominal" in v_lower:
                target_condition = "healthy"

        # If not specified, default by zone: B3 is the canonical SIH demo problem zone
        if not target_condition:
            if zone_id in ["B3", "FIELD-C"]:
                target_condition = "rhizome_rot"
            else:
                target_condition = "healthy"

        source_label = "prerecorded_video_adapter" if video_source else "camera_frame_adapter"

        if target_condition == "rhizome_rot":
            return [
                VisualEvidence(
                    type=VisualEvidenceType.WILTING.value,
                    detected=True,
                    confidence=0.91,
                    source=source_label,
                    details="Severe petiole epinasty and vascular wilting detected across lower canopy.",
                ),
                VisualEvidence(
                    type=VisualEvidenceType.RHIZOME_DISCOLORATION.value,
                    detected=True,
                    confidence=0.82,
                    source=source_label,
                    details="Dark brown collar necrosis indicative of fungal rhizome rot / damping off.",
                ),
            ]
        elif target_condition == "leaf_blotch":
            return [
                VisualEvidence(
                    type=VisualEvidenceType.LEAF_SPOTS.value,
                    detected=True,
                    confidence=0.89,
                    source=source_label,
                    details="Concentric golden-brown leaf blotch (Taphrina maculans) lesions on mature foliage.",
                ),
                VisualEvidence(
                    type=VisualEvidenceType.NECROSIS.value,
                    detected=True,
                    confidence=0.74,
                    source=source_label,
                    details="Chlorotic yellow halos with focal necrotic tissue.",
                ),
            ]
        elif target_condition == "early_blight":
            return [
                VisualEvidence(
                    type=VisualEvidenceType.LEAF_SPOTS.value,
                    detected=True,
                    confidence=0.93,
                    source=source_label,
                    details="Concentric ring 'target spot' lesions identified on mature foliage.",
                ),
                VisualEvidence(
                    type=VisualEvidenceType.NECROSIS.value,
                    detected=True,
                    confidence=0.76,
                    source=source_label,
                    details="Surrounding yellow chlorotic halos with focal necrotic tissue.",
                ),
            ]
        else:
            return [
                VisualEvidence(
                    type=VisualEvidenceType.HEALTHY_CANOPY.value,
                    detected=True,
                    confidence=0.96,
                    source=source_label,
                    details="Canopy foliar index is uniform; no symptomatic lesions or epinasty observed.",
                )
            ]


ml_adapter = MLAdapter()
