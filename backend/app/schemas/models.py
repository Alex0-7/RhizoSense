from __future__ import annotations
from typing import Any
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from backend.app.schemas.enums import (
    Status,
    ConnectionStatus,
    NotificationSeverity,
    NotificationState,
    NotificationType,
    CropHealthCondition,
    RiskType,
    SensorStatus,
    InferenceStatus,
    IrrigationStatus,
    ReadingQuality,
    MetricType,
    AnalyticsPeriod,
)


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class Farm(BaseSchema):
    id: str
    name: str
    location: str | None = None
    area_acres: float
    primary_crop: str
    field_count: int
    created_at: str | None = None
    updated_at: str


class CropHealth(BaseSchema):
    score: float
    condition: CropHealthCondition
    status: Status


class RiskState(BaseSchema):
    type: RiskType
    status: Status
    level: float | None = None
    label: str
    description: str | None = None


class FieldEnvironment(BaseSchema):
    temperature_c: float
    humidity_percent: float
    heat_stress: RiskState
    drought_risk: RiskState
    flood_risk: RiskState
    disease_weather: RiskState
    rainfall_mm: float | None = None
    updated_at: str


class FieldWaterState(BaseSchema):
    soil_moisture_percent: float
    water_stress_percent: float | None = None
    irrigation_needed: bool
    irrigation_status: IrrigationStatus | None = None
    water_consumption_liters: float | None = None
    updated_at: str


class RiskAssessment(BaseSchema):
    type: RiskType
    status: Status
    title: str
    description: str
    detected_at: str | None = None


class AssessmentIndicator(BaseSchema):
    id: str
    label: str
    value: str | None = None
    contribution: str | None = None


class ModelInfo(BaseSchema):
    name: str
    version: str
    inference_type: str | None = None


class AIAssessment(BaseSchema):
    title: str
    summary: str
    confidence_percent: float
    indicators: list[AssessmentIndicator]
    model: ModelInfo | None = None
    generated_at: str


class Recommendation(BaseSchema):
    id: str
    title: str
    action: str
    reason: str
    priority: Status
    generated_at: str
    reviewed: bool = False
    reviewed_at: str | None = None


class SensorReading(BaseSchema):
    timestamp: str
    value: float
    unit: str
    quality: ReadingQuality | None = None


class Sensor(BaseSchema):
    id: str
    field_id: str | None = None
    type: str
    name: str
    status: SensorStatus
    last_reading: SensorReading | None = None
    last_seen_at: str | None = None


class EdgeSystem(BaseSchema):
    status: ConnectionStatus
    ai_inference: InferenceStatus
    camera: SensorStatus
    soil_sensors: SensorStatus
    weather_sensors: SensorStatus
    local_processing: bool
    network: ConnectionStatus
    last_inference_at: str | None = None
    version: str | None = None
    updated_at: str


class EnvironmentalSummary(BaseSchema):
    heat_stress: RiskState
    drought_risk: RiskState
    flood_risk: RiskState
    disease_weather: RiskState
    updated_at: str


class FieldSummary(BaseSchema):
    id: str
    farm_id: str
    name: str
    crop: str
    area_acres: float
    health_percent: float
    soil_moisture_percent: float
    temperature_c: float
    status: Status
    issue: str | None = None
    last_updated: str


class Field(BaseSchema):
    id: str
    farm_id: str
    name: str
    crop: str
    area_acres: float
    status: Status
    crop_health: CropHealth
    environmental: FieldEnvironment
    water: FieldWaterState
    risk: RiskAssessment
    ai_assessment: AIAssessment | None = None
    recommendation: Recommendation | None = None
    last_updated: str


class FieldDetail(Field):
    sensors: list[Sensor] | None = None
    recent_notifications: list["Notification"] | None = None
    historical_metrics: list["MetricSeries"] | None = None


class FarmSummary(BaseSchema):
    farm: Farm
    fields: list[FieldSummary]
    environmental: EnvironmentalSummary
    edge_system: EdgeSystem
    active_notifications: int
    last_updated: str


class NotificationMetadata(BaseSchema):
    metric: str | None = None
    value: float | None = None
    unit: str | None = None
    previous_status: Status | None = None
    current_status: Status | None = None
    risk_type: RiskType | None = None


class Notification(BaseSchema):
    id: str
    farm_id: str
    field_id: str | None = None
    severity: NotificationSeverity
    type: NotificationType
    title: str
    message: str
    status: NotificationState
    recommendation: str | None = None
    created_at: str
    updated_at: str
    resolved_at: str | None = None
    metadata: NotificationMetadata | None = None


class MetricPoint(BaseSchema):
    timestamp: str
    value: float


class MetricSeries(BaseSchema):
    field_id: str
    metric: MetricType
    unit: str
    points: list[MetricPoint]
    period: AnalyticsPeriod
    generated_at: str


class AnalyticsQuery(BaseSchema):
    farm_id: str
    field_id: str | None = None
    metrics: list[MetricType]
    period: AnalyticsPeriod


class AnalyticsResponse(BaseSchema):
    query: AnalyticsQuery
    series: list[MetricSeries]
    generated_at: str


class WebSocketEvent(BaseSchema):
    event: str
    timestamp: str
    payload: Any


class VisionDetectionResult(BaseSchema):
    detected: bool
    disease: str | None = None
    confidence: float


FieldDetail.model_rebuild()
