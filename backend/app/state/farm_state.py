from __future__ import annotations
import copy
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple

from backend.app.schemas.enums import (
    Status,
    ConnectionStatus,
    NotificationSeverity,
    NotificationState,
    NotificationType,
    SensorStatus,
    InferenceStatus,
    MetricType,
    AnalyticsPeriod,
    RiskType,
)
from backend.app.schemas.models import (
    Farm,
    Field,
    FieldSummary,
    EnvironmentalSummary,
    EdgeSystem,
    FarmSummary,
    Notification,
    NotificationMetadata,
    MetricPoint,
    MetricSeries,
    RiskState,
    VisionDetectionResult,
)
from backend.app.services.rules_engine import evaluate_field_condition, get_current_iso_time


class FarmStateManager:
    def __init__(self):
        self.reset_to_baseline()

    def reset_to_baseline(self):
        now = get_current_iso_time()
        self.farm = Farm(
            id="farm-demo",
            name="Demo Farm",
            location="Coimbatore, Tamil Nadu",
            area_acres=12.4,
            primary_crop="Tomato",
            field_count=6,
            created_at=now,
            updated_at=now,
        )

        self.edge_system = EdgeSystem(
            status=ConnectionStatus.CONNECTED,
            ai_inference=InferenceStatus.ACTIVE,
            camera=SensorStatus.CONNECTED,
            soil_sensors=SensorStatus.CONNECTED,
            weather_sensors=SensorStatus.CONNECTED,
            local_processing=True,
            network=ConnectionStatus.CONNECTED,
            last_inference_at=now,
            version="1.2.0-qualcomm-edge",
            updated_at=now,
        )

        # Baseline field configs
        baseline_configs = [
            {"id": "field-a", "name": "Field A", "crop": "Tomato", "area": 2.1, "sm": 54.0, "temp": 28.5, "hum": 62.0, "rain": 0.0, "pest": 8.0},
            {"id": "field-b", "name": "Field B", "crop": "Tomato", "area": 1.8, "sm": 48.0, "temp": 29.2, "hum": 60.0, "rain": 0.0, "pest": 12.0},
            {"id": "field-c", "name": "Field C", "crop": "Tomato", "area": 2.4, "sm": 46.0, "temp": 30.1, "hum": 58.0, "rain": 0.0, "pest": 10.0},
            {"id": "field-d", "name": "Field D", "crop": "Tomato", "area": 2.0, "sm": 38.0, "temp": 31.8, "hum": 55.0, "rain": 0.0, "pest": 15.0},
            {"id": "field-e", "name": "Field E", "crop": "Tomato", "area": 2.3, "sm": 52.0, "temp": 28.9, "hum": 64.0, "rain": 0.0, "pest": 9.0},
            {"id": "field-f", "name": "Field F", "crop": "Tomato", "area": 1.8, "sm": 44.0, "temp": 30.4, "hum": 59.0, "rain": 0.0, "pest": 11.0},
        ]

        self.fields: Dict[str, Field] = {}
        self.vision_detections: Dict[str, VisionDetectionResult] = {
            "field-c": VisionDetectionResult(
                detected=True,
                disease="Early Blight",
                confidence=0.91,
            ),
            "field-a": VisionDetectionResult(
                detected=False,
                disease=None,
                confidence=0.12,
            ),
        }
        for cfg in baseline_configs:
            f_status, c_health, env, water, risk, ai_ass, rec, _ = evaluate_field_condition(
                field_id=cfg["id"],
                farm_id="farm-demo",
                soil_moisture=cfg["sm"],
                temperature=cfg["temp"],
                humidity=cfg["hum"],
                rainfall_mm=cfg["rain"],
                pest_level=cfg["pest"],
            )

            field = Field(
                id=cfg["id"],
                farm_id="farm-demo",
                name=cfg["name"],
                crop=cfg["crop"],
                area_acres=cfg["area"],
                status=f_status,
                crop_health=c_health,
                environmental=env,
                water=water,
                risk=risk,
                ai_assessment=ai_ass,
                recommendation=rec,
                last_updated=now,
            )
            self.fields[cfg["id"]] = field

        # Initial Notifications
        self.notifications: List[Notification] = [
            Notification(
                id="notif-init-001",
                farm_id="farm-demo",
                field_id="field-d",
                severity=NotificationSeverity.ADVISORY,
                type=NotificationType.SOIL_MOISTURE,
                title="Advisory: Mild Moisture Deficit in Field D",
                message="Soil moisture has declined to 38.0%. Monitor upcoming scheduled drip cycles.",
                status=NotificationState.ACTIVE,
                recommendation="Review irrigation schedule for Field D.",
                created_at=(datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat(),
                updated_at=(datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat(),
                metadata=NotificationMetadata(
                    metric="soil_moisture",
                    value=38.0,
                    unit="%",
                    previous_status=Status.NORMAL,
                    current_status=Status.ADVISORY,
                    risk_type=RiskType.WATER_STRESS,
                ),
            ),
            Notification(
                id="notif-init-002",
                farm_id="farm-demo",
                field_id="field-a",
                severity=NotificationSeverity.INFO,
                type=NotificationType.SYSTEM,
                title="Telemetry Synchronized: Edge Node Online",
                message="All 6 field sensory arrays communicating normally with edge Qualcomm processing unit.",
                status=NotificationState.ACTIVE,
                recommendation=None,
                created_at=(datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
                updated_at=(datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            ),
        ]

        # Pre-generate historical analytics points (24H, 7D, 30D) for each field and metric
        self.history: Dict[str, Dict[MetricType, Dict[AnalyticsPeriod, List[MetricPoint]]]] = {}
        self._generate_history()

    def _generate_history(self):
        now_dt = datetime.now(timezone.utc)
        metrics = [
            MetricType.SOIL_MOISTURE,
            MetricType.TEMPERATURE,
            MetricType.HUMIDITY,
            MetricType.CROP_HEALTH,
            MetricType.PEST_ACTIVITY,
            MetricType.DISEASE_RISK,
            MetricType.WATER_CONSUMPTION,
        ]

        for field_id, field in self.fields.items():
            self.history[field_id] = {}
            for metric in metrics:
                self.history[field_id][metric] = {
                    AnalyticsPeriod.PERIOD_24H: [],
                    AnalyticsPeriod.PERIOD_7D: [],
                    AnalyticsPeriod.PERIOD_30D: [],
                }

                # 24H: 24 points (1 per hour)
                base_val = self._get_metric_baseline(field, metric)
                for i in range(24, -1, -1):
                    ts = (now_dt - timedelta(hours=i)).isoformat()
                    val = base_val + (1.2 * ((i % 5) - 2.5))
                    self.history[field_id][metric][AnalyticsPeriod.PERIOD_24H].append(
                        MetricPoint(timestamp=ts, value=round(val, 1))
                    )

                # 7D: 28 points (every 6 hours)
                for i in range(28, -1, -1):
                    ts = (now_dt - timedelta(hours=i * 6)).isoformat()
                    val = base_val + (2.0 * ((i % 4) - 1.5))
                    self.history[field_id][metric][AnalyticsPeriod.PERIOD_7D].append(
                        MetricPoint(timestamp=ts, value=round(val, 1))
                    )

                # 30D: 30 points (1 per day)
                for i in range(30, -1, -1):
                    ts = (now_dt - timedelta(days=i)).isoformat()
                    val = base_val + (3.0 * ((i % 6) - 2.5))
                    self.history[field_id][metric][AnalyticsPeriod.PERIOD_30D].append(
                        MetricPoint(timestamp=ts, value=round(val, 1))
                    )

    def _get_metric_baseline(self, field: Field, metric: MetricType) -> float:
        if metric == MetricType.SOIL_MOISTURE:
            return field.water.soil_moisture_percent
        elif metric == MetricType.TEMPERATURE:
            return field.environmental.temperature_c
        elif metric == MetricType.HUMIDITY:
            return field.environmental.humidity_percent
        elif metric == MetricType.CROP_HEALTH:
            return field.crop_health.score
        elif metric == MetricType.PEST_ACTIVITY:
            return 12.0
        elif metric == MetricType.DISEASE_RISK:
            return 15.0
        elif metric == MetricType.WATER_CONSUMPTION:
            return 140.0
        return 50.0

    def get_farm_summary(self) -> FarmSummary:
        now = get_current_iso_time()
        field_summaries = [
            FieldSummary(
                id=f.id,
                farm_id=f.farm_id,
                name=f.name,
                crop=f.crop,
                area_acres=f.area_acres,
                health_percent=f.crop_health.score,
                soil_moisture_percent=f.water.soil_moisture_percent,
                temperature_c=f.environmental.temperature_c,
                status=f.status,
                issue=f.risk.title if f.status != Status.NORMAL else None,
                last_updated=f.last_updated,
            )
            for f in self.fields.values()
        ]

        # Aggregate environmental conditions across fields (worst case representation)
        heat_statuses = [f.environmental.heat_stress.status for f in self.fields.values()]
        drought_statuses = [f.environmental.drought_risk.status for f in self.fields.values()]
        flood_statuses = [f.environmental.flood_risk.status for f in self.fields.values()]
        disease_statuses = [f.environmental.disease_weather.status for f in self.fields.values()]

        def max_status(statuses: List[Status]) -> Status:
            if Status.CRITICAL in statuses:
                return Status.CRITICAL
            if Status.WARNING in statuses:
                return Status.WARNING
            if Status.ADVISORY in statuses:
                return Status.ADVISORY
            return Status.NORMAL

        environmental = EnvironmentalSummary(
            heat_stress=RiskState(
                type=RiskType.HEAT,
                status=max_status(heat_statuses),
                label="Elevated heat stress" if max_status(heat_statuses) != Status.NORMAL else "Normal canopy temperature",
            ),
            drought_risk=RiskState(
                type=RiskType.DROUGHT,
                status=max_status(drought_statuses),
                label="Elevated drought risk" if max_status(drought_statuses) != Status.NORMAL else "Optimal soil moisture",
            ),
            flood_risk=RiskState(
                type=RiskType.FLOOD,
                status=max_status(flood_statuses),
                label="Elevated surface water risk" if max_status(flood_statuses) != Status.NORMAL else "Low flood risk",
            ),
            disease_weather=RiskState(
                type=RiskType.DISEASE,
                status=max_status(disease_statuses),
                label="Disease-favorable weather" if max_status(disease_statuses) != Status.NORMAL else "Low pathogen weather risk",
            ),
            updated_at=now,
        )

        active_notifs = len([n for n in self.notifications if n.status == NotificationState.ACTIVE])

        return FarmSummary(
            farm=self.farm,
            fields=field_summaries,
            environmental=environmental,
            edge_system=self.edge_system,
            active_notifications=active_notifs,
            last_updated=now,
        )

    def get_field(self, field_id: str) -> Optional[Field]:
        return self.fields.get(field_id)

    def update_field_telemetry(
        self,
        field_id: str,
        soil_moisture: float,
        temperature: float,
        humidity: float,
        rainfall_mm: float = 0.0,
        pest_level: float = 10.0,
        disease_index: float = 15.0,
    ) -> Tuple[Field, Optional[Notification]]:
        if field_id not in self.fields:
            raise KeyError(f"Field {field_id} not found")

        current_field = self.fields[field_id]
        now = get_current_iso_time()

        (
            new_status,
            crop_health,
            env,
            water,
            risk,
            ai_assessment,
            rec,
            notif,
        ) = evaluate_field_condition(
            field_id=field_id,
            farm_id=current_field.farm_id,
            soil_moisture=soil_moisture,
            temperature=temperature,
            humidity=humidity,
            rainfall_mm=rainfall_mm,
            pest_level=pest_level,
            disease_index=disease_index,
            previous_status=current_field.status,
        )

        updated_field = Field(
            id=field_id,
            farm_id=current_field.farm_id,
            name=current_field.name,
            crop=current_field.crop,
            area_acres=current_field.area_acres,
            status=new_status,
            crop_health=crop_health,
            environmental=env,
            water=water,
            risk=risk,
            ai_assessment=ai_assessment,
            recommendation=rec,
            last_updated=now,
        )
        self.fields[field_id] = updated_field

        # Append telemetry point to history
        self._append_telemetry_point(field_id, MetricType.SOIL_MOISTURE, soil_moisture, now)
        self._append_telemetry_point(field_id, MetricType.TEMPERATURE, temperature, now)
        self._append_telemetry_point(field_id, MetricType.HUMIDITY, humidity, now)
        self._append_telemetry_point(field_id, MetricType.CROP_HEALTH, crop_health.score, now)
        self._append_telemetry_point(field_id, MetricType.PEST_ACTIVITY, pest_level, now)
        self._append_telemetry_point(field_id, MetricType.DISEASE_RISK, disease_index, now)

        if notif:
            self.notifications.insert(0, notif)

        self.farm.updated_at = now
        self.edge_system.updated_at = now
        self.edge_system.last_inference_at = now

        return updated_field, notif

    def _append_telemetry_point(self, field_id: str, metric: MetricType, value: float, ts: str):
        if field_id in self.history and metric in self.history[field_id]:
            point = MetricPoint(timestamp=ts, value=round(value, 1))
            h = self.history[field_id][metric]
            h[AnalyticsPeriod.PERIOD_24H].append(point)
            if len(h[AnalyticsPeriod.PERIOD_24H]) > 50:
                h[AnalyticsPeriod.PERIOD_24H].pop(0)

    def get_analytics_series(
        self,
        field_id: str,
        metrics: List[MetricType],
        period: AnalyticsPeriod,
    ) -> List[MetricSeries]:
        units = {
            MetricType.SOIL_MOISTURE: "%",
            MetricType.TEMPERATURE: "°C",
            MetricType.HUMIDITY: "%",
            MetricType.CROP_HEALTH: "%",
            MetricType.PEST_ACTIVITY: "%",
            MetricType.DISEASE_RISK: "%",
            MetricType.WATER_CONSUMPTION: "L",
        }
        now = get_current_iso_time()
        series_list = []

        if field_id not in self.history:
            # Fallback to field-a if invalid or "all"
            field_id = "field-c"

        for m in metrics[:3]:  # Enforce max 3 metrics strictly
            points = self.history.get(field_id, {}).get(m, {}).get(period, [])
            series_list.append(
                MetricSeries(
                    field_id=field_id,
                    metric=m,
                    unit=units.get(m, ""),
                    points=points,
                    period=period,
                    generated_at=now,
                )
            )

        return series_list

    def resolve_notification(self, notif_id: str) -> Optional[Notification]:
        for n in self.notifications:
            if n.id == notif_id:
                n.status = NotificationState.RESOLVED
                n.resolved_at = get_current_iso_time()
                n.updated_at = n.resolved_at
                return n
        return None

    def mark_recommendation_reviewed(self, rec_id: str) -> Optional[Field]:
        now = get_current_iso_time()
        for f in self.fields.values():
            if f.recommendation and f.recommendation.id == rec_id:
                f.recommendation.reviewed = True
                f.recommendation.reviewed_at = now
                f.last_updated = now
                return f
        return None

    def get_vision_detection(self, field_id: str = "field-c") -> VisionDetectionResult:
        if field_id in self.vision_detections:
            return self.vision_detections[field_id]
        return VisionDetectionResult(detected=False, disease=None, confidence=0.12)

    def update_vision_detection(
        self,
        field_id: str,
        detection: VisionDetectionResult,
    ) -> Tuple[VisionDetectionResult, Optional[Notification]]:
        prev = self.get_vision_detection(field_id)
        self.vision_detections[field_id] = detection

        notif = None
        # Trigger ONE warning notification when detection transitions from false -> true
        if not prev.detected and detection.detected:
            now = get_current_iso_time()
            field = self.get_field(field_id)
            field_name = field.name if field else field_id.replace("-", " ").title()
            disease_name = detection.disease or "Crop Disease"
            conf_pct = round(detection.confidence * 100)
            notif = Notification(
                id=f"notif-vision-{field_id}-{int(datetime.now(timezone.utc).timestamp())}",
                farm_id=self.farm.id,
                field_id=field_id,
                severity=NotificationSeverity.WARNING,
                type=NotificationType.DISEASE,
                title=f"{disease_name} detected in {field_name}",
                message=f"Edge vision model detected {disease_name} with {conf_pct}% confidence.",
                status=NotificationState.ACTIVE,
                recommendation="Inspect canopy foliage and initiate targeted biological or fungicidal application.",
                created_at=now,
                updated_at=now,
            )
            self.notifications.insert(0, notif)

        return detection, notif

    def simulate_vision_detection(
        self,
        field_id: str = "field-c",
        force_detected: Optional[bool] = None,
    ) -> Tuple[VisionDetectionResult, Optional[Notification]]:
        current = self.get_vision_detection(field_id)
        new_detected = not current.detected if force_detected is None else force_detected
        new_result = VisionDetectionResult(
            detected=new_detected,
            disease="Early Blight" if new_detected else None,
            confidence=0.91 if new_detected else 0.12,
        )
        return self.update_vision_detection(field_id, new_result)


# Global singleton farm state manager
state_manager = FarmStateManager()
