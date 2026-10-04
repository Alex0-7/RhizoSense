from __future__ import annotations
import base64
import io
import logging
import os
import time
from typing import List, Dict, Any, Optional, Tuple

import requests

from backend.app.schemas.canonical import (
    VisualEvidence,
    VisualEvidenceType,
)

logger = logging.getLogger("rhizosense.roboflow")

# Explicit Turmeric Class Mapping
# Maps raw labels from Roboflow model 'turmeric-final-tmips/1' to canonical VisualEvidence
ROBOFLOW_TURMERIC_CLASS_MAP: Dict[str, Dict[str, Any]] = {
    "leaf_blotch": {
        "canonical_type": VisualEvidenceType.LEAF_SPOTS.value,
        "condition_name": "leaf_blotch",
        "is_disease": True,
        "details": "Turmeric leaf blotch (Taphrina maculans) lesions detected on canopy foliage.",
    },
    "leaf blotch": {
        "canonical_type": VisualEvidenceType.LEAF_SPOTS.value,
        "condition_name": "leaf_blotch",
        "is_disease": True,
        "details": "Turmeric leaf blotch (Taphrina maculans) lesions detected on canopy foliage.",
    },
    "rhizome_rot": {
        "canonical_type": VisualEvidenceType.RHIZOME_DISCOLORATION.value,
        "condition_name": "rhizome_rot",
        "is_disease": True,
        "details": "Turmeric rhizome rot collar necrosis and petiole wilting identified.",
    },
    "rhizome rot": {
        "canonical_type": VisualEvidenceType.RHIZOME_DISCOLORATION.value,
        "condition_name": "rhizome_rot",
        "is_disease": True,
        "details": "Turmeric rhizome rot collar necrosis and petiole wilting identified.",
    },
    "dry_leaf": {
        "canonical_type": VisualEvidenceType.NECROSIS.value,
        "condition_name": "dry_leaf",
        "is_disease": True,
        "details": "Desiccated necrotic foliage observed across upper canopy.",
    },
    "dry leaf": {
        "canonical_type": VisualEvidenceType.NECROSIS.value,
        "condition_name": "dry_leaf",
        "is_disease": True,
        "details": "Desiccated necrotic foliage observed across upper canopy.",
    },
    "healthy_leaf": {
        "canonical_type": VisualEvidenceType.HEALTHY_CANOPY.value,
        "condition_name": "healthy",
        "is_disease": False,
        "details": "Healthy turmeric canopy with uniform foliar spectral index.",
    },
    "healthy leaf": {
        "canonical_type": VisualEvidenceType.HEALTHY_CANOPY.value,
        "condition_name": "healthy",
        "is_disease": False,
        "details": "Healthy turmeric canopy with uniform foliar spectral index.",
    },
    "healthy": {
        "canonical_type": VisualEvidenceType.HEALTHY_CANOPY.value,
        "condition_name": "healthy",
        "is_disease": False,
        "details": "Healthy canopy foliage with uniform chlorophyl index.",
    },
}

# Non-pathological context classes to safely ignore (do not treat as disease)
IGNORED_CONTEXT_CLASSES = {
    "leaf",
    "leaves",
    "plant",
    "stem",
    "turmeric",
    "background",
    "0",
    "crop",
    "soil",
}


class RoboflowService:
    """
    Robust adapter for Roboflow Serverless Inference API (turmeric-final-tmips/1).
    Extracts video frames at a configurable FPS, calls the serverless endpoint,
    maps model predictions into canonical VisualEvidence, and deterministically
    aggregates detections over the video window.
    """

    def __init__(self):
        self.timeout = 10.0

    @property
    def api_key(self) -> str:
        return os.getenv("ROBOFLOW_API_KEY", "").strip()

    @property
    def model_id(self) -> str:
        return os.getenv("ROBOFLOW_MODEL_ID", "turmeric-final-tmips/1").strip()

    @property
    def api_url(self) -> str:
        return os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com").strip().rstrip("/")

    @property
    def frame_fps(self) -> float:
        try:
            return float(os.getenv("ROBOFLOW_FRAME_FPS", "2"))
        except ValueError:
            return 2.0

    def is_configured(self) -> bool:
        """Returns True if a non-empty API key is present."""
        return bool(self.api_key)


    def extract_frames_from_video(
        self, video_path: str, fps: Optional[float] = None, max_frames: int = 6
    ) -> List[Tuple[int, bytes]]:
        """
        Extracts frames from an MP4 video at a specified sampling rate using OpenCV.
        Returns a list of (frame_index, jpeg_bytes).
        """
        if not os.path.exists(video_path):
            logger.warning(f"Video file not found at '{video_path}'")
            return []

        sampling_fps = fps or self.frame_fps
        frames: List[Tuple[int, bytes]] = []

        try:
            import cv2
        except ImportError:
            logger.warning("OpenCV (cv2) is not installed; cannot extract video frames.")
            return []

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.warning(f"Failed to open video file '{video_path}' with OpenCV.")
            return []

        try:
            video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            step = max(1, int(round(video_fps / sampling_fps)))

            current_frame_idx = 0
            while cap.isOpened() and len(frames) < max_frames:
                ret, frame = cap.read()
                if not ret:
                    break

                if current_frame_idx % step == 0:
                    success, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    if success:
                        frames.append((current_frame_idx, buffer.tobytes()))

                current_frame_idx += 1

        except Exception as e:
            logger.error(f"Error during video frame extraction: {e}")
        finally:
            cap.release()

        return frames

    def infer_image(self, image_data: bytes) -> Dict[str, Any]:
        """
        Sends image bytes to Roboflow Serverless Inference API.
        Attempts official inference-sdk if available; otherwise uses direct HTTP.
        """
        if not self.is_configured():
            raise ValueError("ROBOFLOW_API_KEY is not configured.")

        # Try official SDK first if available
        try:
            from inference_sdk import InferenceHTTPClient, InferenceConfiguration
            client = InferenceHTTPClient(
                api_url=self.api_url,
                api_key=self.api_key,
            ).configure(InferenceConfiguration(api_key_transport="header"))

            return client.infer(image_data, model_id=self.model_id)
        except (ImportError, Exception) as sdk_exc:
            logger.debug(f"inference_sdk unavailable or failed ({sdk_exc}), using direct HTTP request.")

        # Fallback to direct HTTP request with Roboflow REST endpoint
        endpoint = f"{self.api_url}/{self.model_id}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }
        files = {
            "file": ("frame.jpg", image_data, "image/jpeg"),
        }
        params = {
            "api_key": self.api_key,
        }

        resp = requests.post(endpoint, files=files, headers=headers, params=params, timeout=self.timeout)
        if resp.status_code != 200:
            raise RuntimeError(f"Roboflow API returned status {resp.status_code}: {resp.text}")

        return resp.json()

    def parse_predictions(self, raw_response: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Parses raw Roboflow response into normalized detection records.
        Handles both object detection and classification formats gracefully.
        """
        parsed: List[Dict[str, Any]] = []

        if not isinstance(raw_response, dict):
            logger.warning(f"Unexpected non-dict Roboflow response: {type(raw_response)}")
            return []

        # Check for top-level error response
        if "error" in raw_response:
            raise RuntimeError(f"Roboflow API error: {raw_response['error']}")

        predictions = raw_response.get("predictions", [])

        # Format 1: Object detection predictions list [{'class': '...', 'confidence': 0.9}]
        if isinstance(predictions, list):
            for pred in predictions:
                if not isinstance(pred, dict):
                    continue
                raw_class = str(pred.get("class", pred.get("label", ""))).strip().lower()
                confidence = float(pred.get("confidence", 0.0))

                if raw_class in IGNORED_CONTEXT_CLASSES:
                    logger.debug(f"Ignoring non-pathological class: {raw_class}")
                    continue

                mapping = ROBOFLOW_TURMERIC_CLASS_MAP.get(raw_class)
                if mapping:
                    parsed.append({
                        "raw_class": raw_class,
                        "canonical_type": mapping["canonical_type"],
                        "condition_name": mapping["condition_name"],
                        "confidence": confidence,
                        "is_disease": mapping["is_disease"],
                        "details": mapping["details"],
                    })
                else:
                    logger.warning(f"Encountered unknown label from Roboflow model: '{raw_class}'")
                    # Safe fallback for unknown disease-like class: treat as foliar symptom if confidence is high
                    if confidence >= 0.5:
                        parsed.append({
                            "raw_class": raw_class,
                            "canonical_type": VisualEvidenceType.LEAF_SPOTS.value,
                            "condition_name": raw_class.replace(" ", "_"),
                            "confidence": confidence,
                            "is_disease": True,
                            "details": f"Unclassified foliar symptom detected by model: '{raw_class}'.",
                        })

        # Format 2: Classification top label
        elif isinstance(predictions, dict):
            for raw_class, conf_val in predictions.items():
                c_clean = str(raw_class).strip().lower()
                conf_float = float(conf_val.get("confidence", conf_val) if isinstance(conf_val, dict) else conf_val)
                if c_clean in ROBOFLOW_TURMERIC_CLASS_MAP:
                    mapping = ROBOFLOW_TURMERIC_CLASS_MAP[c_clean]
                    parsed.append({
                        "raw_class": c_clean,
                        "canonical_type": mapping["canonical_type"],
                        "condition_name": mapping["condition_name"],
                        "confidence": conf_float,
                        "is_disease": mapping["is_disease"],
                        "details": mapping["details"],
                    })

        top_label = raw_response.get("top")
        if top_label and not parsed:
            top_clean = str(top_label).strip().lower()
            top_conf = float(raw_response.get("confidence", 0.8))
            if top_clean in ROBOFLOW_TURMERIC_CLASS_MAP:
                mapping = ROBOFLOW_TURMERIC_CLASS_MAP[top_clean]
                parsed.append({
                    "raw_class": top_clean,
                    "canonical_type": mapping["canonical_type"],
                    "condition_name": mapping["condition_name"],
                    "confidence": top_conf,
                    "is_disease": mapping["is_disease"],
                    "details": mapping["details"],
                })

        return parsed

    def aggregate_window_detections(
        self,
        frames_detections: List[List[Dict[str, Any]]],
        zone_id: str,
    ) -> List[VisualEvidence]:
        """
        Deterministically aggregates parsed detections across all sampled frames in the video window.
        """
        if not frames_detections:
            return [
                VisualEvidence(
                    type=VisualEvidenceType.HEALTHY_CANOPY.value,
                    detected=True,
                    confidence=0.90,
                    source=f"roboflow:{self.model_id}",
                    details="No symptomatic lesions detected across video window.",
                )
            ]

        # Gather all disease detections and healthy detections
        disease_map: Dict[str, List[float]] = {}
        healthy_confidences: List[float] = []

        for frame_dets in frames_detections:
            frame_has_disease = False
            for det in frame_dets:
                if det["is_disease"] and det["confidence"] >= 0.40:
                    cname = det["condition_name"]
                    disease_map.setdefault(cname, []).append(det["confidence"])
                    frame_has_disease = True
                elif not det["is_disease"]:
                    healthy_confidences.append(det["confidence"])

            if not frame_has_disease and not frame_dets:
                healthy_confidences.append(0.85)

        # If any disease detected across frames
        if disease_map:
            # Pick dominant disease by (frequency * mean_confidence)
            scored_diseases = []
            for cname, confs in disease_map.items():
                mean_conf = sum(confs) / len(confs)
                freq = len(confs)
                score = freq * mean_conf
                scored_diseases.append((score, mean_conf, cname))

            scored_diseases.sort(reverse=True)
            top_score, top_mean_conf, dominant_condition = scored_diseases[0]

            evidences: List[VisualEvidence] = []
            source_tag = f"roboflow:{self.model_id}"

            if dominant_condition == "rhizome_rot":
                evidences.append(
                    VisualEvidence(
                        type=VisualEvidenceType.RHIZOME_DISCOLORATION.value,
                        detected=True,
                        confidence=round(min(0.99, max(0.40, top_mean_conf)), 2),
                        source=source_tag,
                        details="Roboflow inference identified rhizome rot collar necrosis across video frames.",
                    )
                )
                evidences.append(
                    VisualEvidence(
                        type=VisualEvidenceType.WILTING.value,
                        detected=True,
                        confidence=round(min(0.99, max(0.40, top_mean_conf - 0.05)), 2),
                        source=source_tag,
                        details="Canopy foliar wilting and vascular epinasty observed.",
                    )
                )
            elif dominant_condition in ["leaf_blotch", "early_blight"]:
                evidences.append(
                    VisualEvidence(
                        type=VisualEvidenceType.LEAF_SPOTS.value,
                        detected=True,
                        confidence=round(min(0.99, max(0.40, top_mean_conf)), 2),
                        source=source_tag,
                        details="Roboflow inference identified turmeric leaf blotch (Taphrina maculans) lesions.",
                    )
                )
                evidences.append(
                    VisualEvidence(
                        type=VisualEvidenceType.NECROSIS.value,
                        detected=True,
                        confidence=round(min(0.99, max(0.40, top_mean_conf - 0.10)), 2),
                        source=source_tag,
                        details="Focal necrotic halos visible on mature foliage.",
                    )
                )
            elif dominant_condition == "dry_leaf":
                evidences.append(
                    VisualEvidence(
                        type=VisualEvidenceType.NECROSIS.value,
                        detected=True,
                        confidence=round(min(0.99, max(0.40, top_mean_conf)), 2),
                        source=source_tag,
                        details="Desiccated foliage detected by Roboflow model.",
                    )
                )
            else:
                evidences.append(
                    VisualEvidence(
                        type=VisualEvidenceType.LEAF_SPOTS.value,
                        detected=True,
                        confidence=round(min(0.99, max(0.40, top_mean_conf)), 2),
                        source=source_tag,
                        details=f"Roboflow model detected condition: {dominant_condition}",
                    )
                )

            return evidences

        # Otherwise, healthy
        avg_healthy = sum(healthy_confidences) / len(healthy_confidences) if healthy_confidences else 0.95
        return [
            VisualEvidence(
                type=VisualEvidenceType.HEALTHY_CANOPY.value,
                detected=True,
                confidence=round(min(0.99, max(0.70, avg_healthy)), 2),
                source=f"roboflow:{self.model_id}",
                details="Canopy foliage is healthy and free of pathological lesions across all sampled video frames.",
            )
        ]

    def process_video_or_frame(
        self,
        video_path: Optional[str] = None,
        image_base64: Optional[str] = None,
        zone_id: str = "B3",
        fps: Optional[float] = None,
    ) -> Tuple[List[VisualEvidence], str, Optional[str], int]:
        """
        Executes end-to-end processing:
        1. Frame sampling from video or base64 frame decode.
        2. Roboflow inference.
        3. Response parsing and mapping.
        4. Deterministic aggregation.
        If Roboflow is not configured or encounters errors, falls back gracefully.
        Returns: (evidences, provider_label, provider_note, frames_processed)
        """
        if not self.is_configured():
            return [], "fallback/demo", "ROBOFLOW_API_KEY is not configured in backend environment; using deterministic fallback.", 0

        # Step 1: Collect frame bytes
        frames_to_infer: List[bytes] = []

        if image_base64:
            try:
                # Strip data URL prefix if present
                raw_b64 = image_base64.split(",")[-1] if "," in image_base64 else image_base64
                frames_to_infer.append(base64.b64decode(raw_b64))
            except Exception as e:
                logger.warning(f"Failed to decode image_base64: {e}")

        if not frames_to_infer and video_path:
            extracted = self.extract_frames_from_video(video_path, fps=fps, max_frames=6)
            frames_to_infer = [f[1] for f in extracted]

        if not frames_to_infer:
            return [], "fallback/demo", "No valid video frames could be extracted for inference.", 0

        # Step 2: Run Roboflow on each frame
        all_parsed: List[List[Dict[str, Any]]] = []
        try:
            for frame_bytes in frames_to_infer:
                raw_resp = self.infer_image(frame_bytes)
                parsed = self.parse_predictions(raw_resp)
                all_parsed.append(parsed)

            # Step 3: Aggregate
            evidences = self.aggregate_window_detections(all_parsed, zone_id=zone_id)
            return evidences, "roboflow", f"Successfully evaluated {len(frames_to_infer)} frames via Roboflow ({self.model_id}).", len(frames_to_infer)

        except Exception as exc:
            logger.error(f"Roboflow inference error: {exc}")
            return [], "fallback/demo", f"Roboflow API error: {str(exc)}; falling back to deterministic demo.", len(all_parsed)


roboflow_service = RoboflowService()
