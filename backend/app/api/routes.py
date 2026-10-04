from typing import Optional, List, Union, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field as PydanticField

from backend.app.schemas.enums import (
    Status,
    NotificationSeverity,
    NotificationState,
    MetricType,
    AnalyticsPeriod,
)
from backend.app.schemas.models import (
    FarmSummary,
    Field,
    FieldSummary,
    Notification,
    AnalyticsResponse,
    AnalyticsQuery,
    VisionDetectionResult,
)
from backend.app.schemas.canonical import (
    Zone,
    VisualEvidence,
    SensorReading,
    DiagnosisResult,
    SyncRecord,
    RiskLevel,
    ConfidenceTier,
)
from backend.app.state.farm_state import state_manager
from backend.app.events.websocket_manager import ws_manager
from backend.app.services.rules_engine import get_current_iso_time
from backend.app.services.ml_adapter import InferenceRequest

router = APIRouter(prefix="/api")


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "2.0.0"


class TelemetryInput(BaseModel):
    field_id: str
    soil_moisture: float
    temperature: float
    humidity: float
    rainfall_mm: float = 0.0
    pest_level: float = 10.0
    disease_index: float = 15.0


class InferenceResponse(BaseModel):
    zone_id: str
    visual_evidence: List[VisualEvidence]
    diagnosis: DiagnosisResult
    alert_created: bool = False
    provider: str = PydanticField(default="demo", description="Active inference provider: roboflow, fallback/demo, demo")
    provider_note: Optional[str] = PydanticField(None, description="Diagnostic note from provider")
    frames_processed: int = PydanticField(default=1, description="Number of sampled frames analyzed")




class ActionAcknowledgeRequest(BaseModel):
    zone_id: str
    recommendation_id: Optional[str] = None
    action_taken: str = "acknowledged"
    notes: Optional[str] = None


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", timestamp=get_current_iso_time())


# ==========================================
# V2 Canonical Zone & Diagnosis Endpoints
# ==========================================

@router.get("/zones", response_model=List[Zone])
async def list_zones():
    return state_manager.get_zones()


@router.get("/zones/{zone_id}", response_model=Zone)
async def get_zone_detail(zone_id: str):
    zone = state_manager.get_zone(zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")
    return zone


@router.get("/diagnosis/{zone_id}", response_model=DiagnosisResult)
async def get_zone_diagnosis(zone_id: str):
    diag = state_manager.get_zone_diagnosis(zone_id)
    if not diag:
        raise HTTPException(status_code=404, detail=f"Diagnosis for zone '{zone_id}' not found")
    return diag


@router.post("/sensors/readings")
async def ingest_sensor_readings(readings: Union[SensorReading, List[SensorReading]]):
    readings_list = readings if isinstance(readings, list) else [readings]
    if not readings_list:
        raise HTTPException(status_code=400, detail="Empty sensor readings list")

    diag, notif = state_manager.ingest_sensor_readings(readings_list)
    zone_obj = state_manager.get_zone(diag.zone_id)

    # Broadcast WebSocket updates
    if zone_obj:
        await ws_manager.broadcast_event("zone.updated", zone_obj)
    await ws_manager.broadcast_event("diagnosis.created", diag)
    if notif:
        await ws_manager.broadcast_event("notification.created", notif)

    farm_summary = state_manager.get_farm_summary()
    await ws_manager.broadcast_event("farm.updated", farm_summary)

    return {
        "status": "ingested",
        "zone_id": diag.zone_id,
        "risk_level": diag.diagnosis.risk_level.value,
        "condition": diag.diagnosis.condition,
        "notification_created": notif is not None,
    }


class ReadSensorsRequest(BaseModel):
    zone_id: str = "B3"
    scenario: str = "drought"
    tick: Optional[int] = None


@router.post("/simulator/read-sensors")
async def trigger_read_sensors(payload: ReadSensorsRequest = Body(default_factory=ReadSensorsRequest)):
    from simulator.sensor_source import read_sensors
    readings = read_sensors(zone_id=payload.zone_id, scenario_name=payload.scenario, tick=payload.tick)
    diag, notif = state_manager.ingest_sensor_readings(readings)
    zone_obj = state_manager.get_zone(diag.zone_id)

    if zone_obj:
        await ws_manager.broadcast_event("zone.updated", zone_obj)
    await ws_manager.broadcast_event("diagnosis.created", diag)
    if notif:
        await ws_manager.broadcast_event("notification.created", notif)

    farm_summary = state_manager.get_farm_summary()
    await ws_manager.broadcast_event("farm.updated", farm_summary)

    return {
        "status": "read_sensors_ingested",
        "zone_id": diag.zone_id,
        "readings_count": len(readings),
        "diagnosis": diag,
        "notification_created": notif is not None,
    }



@router.post("/vision/infer", response_model=InferenceResponse)
async def run_vision_inference(request: InferenceRequest):
    evidences, diag, notif, provider, provider_note, frames_count = state_manager.run_inference_for_zone(request)
    zone_obj = state_manager.get_zone(diag.zone_id)

    if zone_obj:
        await ws_manager.broadcast_event("zone.updated", zone_obj)
    await ws_manager.broadcast_event("diagnosis.created", diag)
    if notif:
        await ws_manager.broadcast_event("notification.created", notif)

    farm_summary = state_manager.get_farm_summary()
    await ws_manager.broadcast_event("farm.updated", farm_summary)

    return InferenceResponse(
        zone_id=diag.zone_id,
        visual_evidence=evidences,
        diagnosis=diag,
        alert_created=notif is not None,
        provider=provider,
        provider_note=provider_note,
        frames_processed=frames_count,
    )



@router.get("/vision/config")
async def get_vision_config():
    from backend.app.services.ml_adapter import ml_adapter
    return ml_adapter.get_config().model_dump()


@router.post("/sync")
async def sync_offline_records(records: List[SyncRecord]):
    result = state_manager.reconcile_sync_records(records)
    await ws_manager.broadcast_event("sync.status", result)
    return result


@router.post("/actions/acknowledge")
async def acknowledge_farmer_action(payload: ActionAcknowledgeRequest):
    zone_obj = state_manager.get_zone(payload.zone_id)
    if not zone_obj:
        raise HTTPException(status_code=404, detail=f"Zone '{payload.zone_id}' not found")

    now = get_current_iso_time()
    if payload.recommendation_id:
        state_manager.mark_recommendation_reviewed(payload.recommendation_id)

    await ws_manager.broadcast_event("farmer.action", {
        "zone_id": payload.zone_id,
        "action": payload.action_taken,
        "timestamp": now,
    })

    return {
        "status": "acknowledged",
        "zone_id": payload.zone_id,
        "action_taken": payload.action_taken,
        "timestamp": now,
    }


# ==========================================
# Legacy / Admin V1 Endpoints (Preserved)
# ==========================================

@router.get("/farm", response_model=FarmSummary)
async def get_farm():
    return state_manager.get_farm_summary()


@router.get("/fields")
async def get_fields():
    farm_summary = state_manager.get_farm_summary()
    return {
        "fields": [f.model_dump(by_alias=True) for f in farm_summary.fields],
        "updatedAt": farm_summary.last_updated,
    }


@router.get("/fields/{field_id}", response_model=Field)
async def get_field_detail(field_id: str):
    field = state_manager.get_field(field_id)
    if not field:
        raise HTTPException(status_code=404, detail=f"Field '{field_id}' not found")
    return field


@router.get("/notifications")
async def get_notifications(
    status: Optional[NotificationState] = None,
    severity: Optional[NotificationSeverity] = None,
    field_id: Optional[str] = Query(None, alias="fieldId"),
    limit: int = 50,
):
    notifs = state_manager.notifications
    if status:
        notifs = [n for n in notifs if n.status == status]
    if severity:
        notifs = [n for n in notifs if n.severity == severity]
    if field_id:
        norm = "B3" if field_id.lower() in ["field-c", "c"] else field_id
        notifs = [n for n in notifs if n.field_id in [field_id, norm]]

    paginated = notifs[:limit]
    return {
        "notifications": [n.model_dump(by_alias=True) for n in paginated],
        "total": len(notifs),
        "updatedAt": get_current_iso_time(),
    }


@router.post("/notifications/{notification_id}/resolve")
async def resolve_notification(notification_id: str):
    notif = state_manager.resolve_notification(notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail=f"Notification '{notification_id}' not found")

    await ws_manager.broadcast_event(
        "notification.resolved",
        {"notificationId": notif.id, "fieldId": notif.field_id, "resolvedAt": notif.resolved_at},
    )
    farm_summary = state_manager.get_farm_summary()
    await ws_manager.broadcast_event("farm.updated", farm_summary)

    return {"notification": notif.model_dump(by_alias=True)}


@router.post("/recommendations/{recommendation_id}/review")
async def review_recommendation(recommendation_id: str):
    field = state_manager.mark_recommendation_reviewed(recommendation_id)
    if not field:
        raise HTTPException(status_code=404, detail=f"Recommendation '{recommendation_id}' not found")

    field_summary = FieldSummary(
        id=field.id,
        farm_id=field.farm_id,
        name=field.name,
        crop=field.crop,
        area_acres=field.area_acres,
        health_percent=field.crop_health.score,
        soil_moisture_percent=field.water.soil_moisture_percent,
        temperature_c=field.environmental.temperature_c,
        status=field.status,
        issue=field.risk.title if field.status != Status.NORMAL else None,
        last_updated=field.last_updated,
    )
    await ws_manager.broadcast_event("field.updated", field_summary)
    await ws_manager.broadcast_event("field.detail.updated", field)

    return {"recommendation": field.recommendation.model_dump(by_alias=True) if field.recommendation else {}}


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    field_id: str = Query("field-c", alias="fieldId"),
    metrics: str = Query("soil_moisture,temperature,crop_health"),
    period: AnalyticsPeriod = AnalyticsPeriod.PERIOD_24H,
):
    metric_enums: List[MetricType] = []
    for m in metrics.split(","):
        clean_m = m.strip().lower()
        try:
            metric_enums.append(MetricType(clean_m))
        except ValueError:
            pass

    if not metric_enums:
        metric_enums = [MetricType.SOIL_MOISTURE, MetricType.TEMPERATURE]

    metric_enums = metric_enums[:3]

    series = state_manager.get_analytics_series(
        field_id=field_id,
        metrics=metric_enums,
        period=period,
    )

    query = AnalyticsQuery(
        farm_id="farm-demo",
        field_id=field_id,
        metrics=metric_enums,
        period=period,
    )

    return AnalyticsResponse(
        query=query,
        series=series,
        generated_at=get_current_iso_time(),
    )


@router.post("/simulator/telemetry")
async def ingest_simulator_telemetry(payload: TelemetryInput):
    target_zone = "B3" if payload.field_id.lower() in ["field-c", "c"] else payload.field_id.upper()
    now = get_current_iso_time()

    # Ingest into canonical zone engine
    readings = [
        SensorReading(zone_id=target_zone, metric="soil_moisture", value=payload.soil_moisture, unit="%", timestamp=now, source="simulator"),
        SensorReading(zone_id=target_zone, metric="soil_temperature", value=payload.temperature, unit="°C", timestamp=now, source="simulator"),
        SensorReading(zone_id=target_zone, metric="humidity", value=payload.humidity, unit="%", timestamp=now, source="simulator"),
        SensorReading(zone_id=target_zone, metric="rainfall_mm", value=payload.rainfall_mm, unit="mm", timestamp=now, source="simulator"),
        SensorReading(zone_id=target_zone, metric="pest_level", value=payload.pest_level, unit="%", timestamp=now, source="simulator"),
    ]
    diag, zone_notif = state_manager.ingest_sensor_readings(readings)

    # Ingest into legacy field manager
    updated_field = state_manager.get_field(payload.field_id) or state_manager.get_field("field-c")

    # Broadcast events
    zone_obj = state_manager.get_zone(target_zone)
    if zone_obj:
        await ws_manager.broadcast_event("zone.updated", zone_obj)
    await ws_manager.broadcast_event("diagnosis.created", diag)

    if updated_field:
        field_summary = FieldSummary(
            id=updated_field.id,
            farm_id=updated_field.farm_id,
            name=updated_field.name,
            crop=updated_field.crop,
            area_acres=updated_field.area_acres,
            health_percent=updated_field.crop_health.score,
            soil_moisture_percent=updated_field.water.soil_moisture_percent,
            temperature_c=updated_field.environmental.temperature_c,
            status=updated_field.status,
            issue=updated_field.risk.title if updated_field.status != Status.NORMAL else None,
            last_updated=updated_field.last_updated,
        )
        await ws_manager.broadcast_event("field.updated", field_summary)
        await ws_manager.broadcast_event("field.detail.updated", updated_field)

    if zone_notif:
        await ws_manager.broadcast_event("notification.created", zone_notif)

    farm_summary = state_manager.get_farm_summary()
    await ws_manager.broadcast_event("farm.updated", farm_summary)

    return {
        "status": "received",
        "fieldId": payload.field_id,
        "zoneId": target_zone,
        "fieldStatus": updated_field.status.value if updated_field else "normal",
        "riskLevel": diag.diagnosis.risk_level.value,
        "notificationCreated": zone_notif is not None,
    }


@router.post("/simulator/reset")
async def reset_simulation():
    state_manager.reset_to_baseline()
    farm_summary = state_manager.get_farm_summary()
    await ws_manager.broadcast_event("farm.updated", farm_summary)
    return {"status": "reset", "message": "Farm and 25 micro-zones reset to baseline state"}


@router.get("/vision/detection", response_model=VisionDetectionResult)
async def get_vision_detection(field_id: str = Query("field-c", alias="fieldId")):
    return state_manager.get_vision_detection(field_id)


@router.post("/vision/detection", response_model=VisionDetectionResult)
async def submit_vision_detection(
    payload: VisionDetectionResult,
    field_id: str = Query("field-c", alias="fieldId"),
):
    result, notif = state_manager.update_vision_detection(field_id, payload)
    await ws_manager.broadcast_event("vision.detection", {
        "fieldId": field_id,
        "detection": result.model_dump(by_alias=True),
    })
    if notif:
        await ws_manager.broadcast_event("notification.created", notif)
    return result


@router.post("/vision/simulate", response_model=VisionDetectionResult)
async def simulate_vision_detection(
    field_id: str = Query("field-c", alias="fieldId"),
    detected: Optional[bool] = Query(None),
):
    result, notif = state_manager.simulate_vision_detection(field_id, force_detected=detected)
    await ws_manager.broadcast_event("vision.detection", {
        "fieldId": field_id,
        "detection": result.model_dump(by_alias=True),
    })
    if notif:
        await ws_manager.broadcast_event("notification.created", notif)
    return result
