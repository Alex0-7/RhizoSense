from __future__ import annotations
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    HEALTHY = "HEALTHY"
    MONITOR = "MONITOR"
    ATTENTION = "ATTENTION"
    ACTION_REQUIRED = "ACTION_REQUIRED"


class ConfidenceTier(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class VisualEvidenceType(str, Enum):
    WILTING = "wilting"
    NECROSIS = "necrosis"
    YELLOWING = "yellowing"
    LEAF_SPOTS = "leaf_spots"
    RHIZOME_DISCOLORATION = "rhizome_discoloration"
    HEALTHY_CANOPY = "healthy_canopy"


class Zone(BaseModel):
    zone_id: str = Field(..., description="Stable zone identifier, e.g. 'B3'")
    row: int = Field(..., description="Grid row (1-indexed)")
    column: int = Field(..., description="Grid column (1-indexed)")
    grid_size_m: int = Field(default=5, description="Physical grid dimension in meters")
    crop: str = Field(default="Tomato", description="Cultivated crop")
    current_risk: RiskLevel = Field(default=RiskLevel.HEALTHY)
    last_updated: Optional[str] = None


class VisualEvidence(BaseModel):
    type: str = Field(..., description="Observed visual symptom or pattern")
    detected: bool = Field(default=True, description="Whether symptom was detected")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence as 0.0 - 1.0")
    source: str = Field(default="vision", description="Evidence source, e.g. vision or camera")
    details: Optional[str] = None


class SensorReading(BaseModel):
    zone_id: str = Field(..., description="Associated zone ID")
    metric: str = Field(..., description="Sensor metric name, e.g. soil_moisture, soil_temperature")
    value: float = Field(..., description="Sensor numeric value")
    unit: str = Field(..., description="Explicit engineering unit, e.g. % or °C")
    timestamp: str = Field(..., description="ISO-8601 reading timestamp")
    source: str = Field(default="sensor", description="Source: sensor, simulator, or edge_node")


class EnvironmentalMatch(BaseModel):
    matched: bool = Field(..., description="Whether current weather/environment matches disease conditions")
    reason: str = Field(..., description="Agronomic explanation of the match or mismatch")


class Advisory(BaseModel):
    action: str = Field(..., description="Primary recommended farmer action")
    secondary_action: Optional[str] = Field(None, description="Optional secondary action")
    urgency: Optional[RiskLevel] = None
    reason: Optional[str] = None
    voice_text: Optional[Dict[str, str]] = Field(
        default=None,
        description="Localized advisory text for voice synthesis: en, ta, hi",
    )


class DiagnosisCore(BaseModel):
    condition: str = Field(..., description="Identified agricultural condition, e.g. rhizome_rot or healthy")
    confidence: ConfidenceTier = Field(..., description="Canonical confidence tier: LOW, MEDIUM, HIGH")
    risk_level: RiskLevel = Field(..., description="Canonical risk level")


class DiagnosisResult(BaseModel):
    zone_id: str = Field(..., description="Affected zone identifier")
    timestamp: str = Field(..., description="ISO-8601 evaluation timestamp")
    diagnosis: DiagnosisCore = Field(..., description="Core diagnosis summary")
    visual_evidence: List[VisualEvidence] = Field(default_factory=list)
    sensor_evidence: List[SensorReading] = Field(default_factory=list)
    environmental_match: EnvironmentalMatch = Field(..., description="Environmental context evaluation")
    recommendation: Advisory = Field(..., description="Actionable farmer recommendation")


class SyncStatus(str, Enum):
    PENDING = "PENDING"
    SYNCED = "SYNCED"
    FAILED = "FAILED"


class SyncRecord(BaseModel):
    local_id: str = Field(..., description="Unique client-generated local ID")
    event_type: str = Field(..., description="Event type: e.g. diagnosis, sensor_reading, alert_ack")
    timestamp: str = Field(..., description="ISO-8601 timestamp")
    payload: Dict[str, Any] = Field(..., description="Arbitrary canonical payload")
    sync_status: SyncStatus = Field(default=SyncStatus.PENDING)
    retry_count: int = Field(default=0)
    error_message: Optional[str] = None


# Helpers for bidirectional V1 / V2 translation
def status_to_risk_level(status_str: str) -> RiskLevel:
    clean = str(status_str).lower().strip()
    if clean == "critical":
        return RiskLevel.ACTION_REQUIRED
    elif clean == "warning":
        return RiskLevel.ATTENTION
    elif clean == "advisory":
        return RiskLevel.MONITOR
    return RiskLevel.HEALTHY


def risk_level_to_status_str(risk: RiskLevel) -> str:
    if risk == RiskLevel.ACTION_REQUIRED:
        return "critical"
    elif risk == RiskLevel.ATTENTION:
        return "warning"
    elif risk == RiskLevel.MONITOR:
        return "advisory"
    return "normal"


def confidence_float_to_tier(conf: float) -> ConfidenceTier:
    if conf >= 0.80:
        return ConfidenceTier.HIGH
    elif conf >= 0.50:
        return ConfidenceTier.MEDIUM
    return ConfidenceTier.LOW


def tier_to_confidence_float(tier: ConfidenceTier) -> float:
    if tier == ConfidenceTier.HIGH:
        return 0.91
    elif tier == ConfidenceTier.MEDIUM:
        return 0.72
    return 0.40
