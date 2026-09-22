from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

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
from backend.app.state.farm_state import state_manager
from backend.app.events.websocket_manager import ws_manager
from backend.app.services.rules_engine import get_current_iso_time

router = APIRouter(prefix="/api")


class HealthResponse(BaseModel):
    status: str
    timestamp: str


class FieldsListResponse(BaseModel):
    fields: List[FieldSummary]
    updated_at: str


class NotificationsListResponse(BaseModel):
    notifications: List[Notification]
    total: int
    updated_at: str


class TelemetryInput(BaseModel):
    field_id: str
    soil_moisture: float
    temperature: float
    humidity: float
    rainfall_mm: float = 0.0
    pest_level: float = 10.0
    disease_index: float = 15.0


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", timestamp=get_current_iso_time())


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
        notifs = [n for n in notifs if n.field_id == field_id]

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

    # Max 3 metrics rule
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
    try:
        updated_field, notif = state_manager.update_field_telemetry(
            field_id=payload.field_id,
            soil_moisture=payload.soil_moisture,
            temperature=payload.temperature,
            humidity=payload.humidity,
            rainfall_mm=payload.rainfall_mm,
            pest_level=payload.pest_level,
            disease_index=payload.disease_index,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Field '{payload.field_id}' not found")

    # Broadcast events
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

    if notif:
        await ws_manager.broadcast_event("notification.created", notif)

    farm_summary = state_manager.get_farm_summary()
    await ws_manager.broadcast_event("farm.updated", farm_summary)

    return {
        "status": "received",
        "fieldId": updated_field.id,
        "fieldStatus": updated_field.status.value,
        "notificationCreated": notif is not None,
    }


@router.post("/simulator/reset")
async def reset_simulation():
    state_manager.reset_to_baseline()
    farm_summary = state_manager.get_farm_summary()
    await ws_manager.broadcast_event("farm.updated", farm_summary)
    return {"status": "reset", "message": "All fields reset to normal baseline state"}


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

