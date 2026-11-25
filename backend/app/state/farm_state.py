from __future__ import annotations
import copy
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any

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
    CropHealthCondition,
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
    CropHealth,
    RiskAssessment,
    AIAssessment,
    AssessmentIndicator,
    ModelInfo,
    Recommendation,
)
from backend.app.schemas.canonical import (
    Zone,
    VisualEvidence,
    SensorReading,
    DiagnosisResult,
    RiskLevel,
    ConfidenceTier,
    SyncRecord,
    SyncStatus,
    status_to_risk_level,
    risk_level_to_status_str,
)
from backend.app.services.rules_engine import evaluate_field_condition, get_current_iso_time
from backend.app.services.fusion_engine import fusion_engine
from backend.app.services.ml_adapter import ml_adapter, InferenceRequest


ROW_LETTERS = ["A", "B", "C", "D", "E"]


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
            version="2.0.0-rhizosense-edge",
            updated_at=now,
        )

        # 1. Initialize 5m x 5m micro-zones (A1 through E5: 25 spatial zones)
        self.zones: Dict[str, Zone] = {}
        self.zone_sensors: Dict[str, List[SensorReading]] = {}
        self.zone_visuals: Dict[str, List[VisualEvidence]] = {}
        self.zone_diagnoses: Dict[str, DiagnosisResult] = {}
        self.sync_records: List[SyncRecord] = []

        for r_idx, letter in enumerate(ROW_LETTERS, start=1):
            for c_idx in range(1, 6):
                z_id = f"{letter}{c_idx}"
                self.zones[z_id] = Zone(
                    zone_id=z_id,
                    row=r_idx,
                    column=c_idx,
                    grid_size_m=5,
                    crop="Tomato",
                    current_risk=RiskLevel.HEALTHY,
                    last_updated=now,
                )

                # Default baseline sensor readings
                default_sensors = [
                    SensorReading(zone_id=z_id, metric="soil_moisture", value=52.0, unit="%", timestamp=now, source="sensor"),
                    SensorReading(zone_id=z_id, metric="soil_temperature", value=28.5, unit="°C", timestamp=now, source="sensor"),
                    SensorReading(zone_id=z_id, metric="humidity", value=60.0, unit="%", timestamp=now, source="sensor"),
                    SensorReading(zone_id=z_id, metric="rainfall_mm", value=0.0, unit="mm", timestamp=now, source="sensor"),
                    SensorReading(zone_id=z_id, metric="pest_level", value=8.0, unit="%", timestamp=now, source="sensor"),
                ]
                self.zone_sensors[z_id] = default_sensors
                self.zone_visuals[z_id] = []
                self.zone_diagnoses[z_id] = fusion_engine.fuse_zone_evidence(
                    zone_id=z_id,
                    sensor_readings=default_sensors,
                    visual_evidence=[],
                )

        # Problem zone B3 initial condition
        self.zones["B3"].current_risk = RiskLevel.ATTENTION
        self.zone_sensors["B3"] = [
            SensorReading(zone_id="B3", metric="soil_moisture", value=46.0, unit="%", timestamp=now, source="sensor"),
            SensorReading(zone_id="B3", metric="soil_temperature", value=30.1, unit="°C", timestamp=now, source="sensor"),
            SensorReading(zone_id="B3", metric="humidity", value=58.0, unit="%", timestamp=now, source="sensor"),
            SensorReading(zone_id="B3", metric="rainfall_mm", value=0.0, unit="mm", timestamp=now, source="sensor"),
            SensorReading(zone_id="B3", metric="pest_level", value=12.0, unit="%", timestamp=now, source="sensor"),
        ]
        self.zone_visuals["B3"] = [
            VisualEvidence(type="leaf_spots", detected=True, confidence=0.84, source="vision", details="Early blight foliar lesions"),
        ]
        self.zone_diagnoses["B3"] = fusion_engine.fuse_zone_evidence(
            zone_id="B3",
            sensor_readings=self.zone_sensors["B3"],
            visual_evidence=self.zone_visuals["B3"],
        )

        # 2. Legacy baseline field configs for backward compatibility
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
                field_id="B3",
                severity=NotificationSeverity.WARNING,
                type=NotificationType.DISEASE,
                title="Attention: Early Blight Risk in Zone B3",
                message="Visual leaf symptoms and environmental match detected in Zone B3.",
                status=NotificationState.ACTIVE,
                recommendation="Apply targeted bio-fungicide spray.",
                created_at=(datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat(),
                updated_at=(datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat(),
                metadata=NotificationMetadata(
                    metric="soil_moisture",
                    value=46.0,
                    unit="%",
                    previous_status=Status.NORMAL,
                    current_status=Status.WARNING,
                    risk_type=RiskType.DISEASE,
                ),
            ),
            Notification(
                id="notif-init-002",
                farm_id="farm-demo",
                field_id="field-a",
                severity=NotificationSeverity.INFO,
                type=NotificationType.SYSTEM,
                title="Telemetry Synchronized: Edge Node Online",
                message="25 micro-zones communicating normally with edge intelligence unit.",
                status=NotificationState.ACTIVE,
                recommendation=None,
                created_at=(datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
                updated_at=(datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            ),
        ]

        # Pre-generate historical analytics points (24H, 7D, 30D)
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

        # History for fields and zones
        all_ids = list(self.fields.keys()) + ["B3", "field-c"]
        for fid in set(all_ids):
            field_obj = self.fields.get(fid) or self.fields.get("field-c")
            self.history[fid] = {}
            for metric in metrics:
                self.history[fid][metric] = {
                    AnalyticsPeriod.PERIOD_24H: [],
                    AnalyticsPeriod.PERIOD_7D: [],
                    AnalyticsPeriod.PERIOD_30D: [],
                }

                base_val = self._get_metric_baseline(field_obj, metric)
                for i in range(24, -1, -1):
                    ts = (now_dt - timedelta(hours=i)).isoformat()
                    val = base_val + (1.2 * ((i % 5) - 2.5))
                    self.history[fid][metric][AnalyticsPeriod.PERIOD_24H].append(
                        MetricPoint(timestamp=ts, value=round(val, 1))
                    )
                for i in range(28, -1, -1):
                    ts = (now_dt - timedelta(hours=i * 6)).isoformat()
                    val = base_val + (2.0 * ((i % 4) - 1.5))
                    self.history[fid][metric][AnalyticsPeriod.PERIOD_7D].append(
                        MetricPoint(timestamp=ts, value=round(val, 1))
                    )
                for i in range(30, -1, -1):
                    ts = (now_dt - timedelta(days=i)).isoformat()
                    val = base_val + (3.0 * ((i % 6) - 2.5))
                    self.history[fid][metric][AnalyticsPeriod.PERIOD_30D].append(
                        MetricPoint(timestamp=ts, value=round(val, 1))
                    )

    def _get_metric_baseline(self, field: Field, metric: MetricType) -> float:
        if not field:
            return 50.0
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

    # Zone Management (V2)
    def get_zones(self) -> List[Zone]:
        return list(self.zones.values())

    def get_zone(self, zone_id: str) -> Optional[Zone]:
        norm_id = self._normalize_zone_id(zone_id)
        return self.zones.get(norm_id)

    def get_zone_diagnosis(self, zone_id: str) -> Optional[DiagnosisResult]:
        norm_id = self._normalize_zone_id(zone_id)
        return self.zone_diagnoses.get(norm_id)

    def get_zone_sensors(self, zone_id: str) -> List[SensorReading]:
        norm_id = self._normalize_zone_id(zone_id)
        return self.zone_sensors.get(norm_id, [])

    def get_zone_visuals(self, zone_id: str) -> List[VisualEvidence]:
        norm_id = self._normalize_zone_id(zone_id)
        return self.zone_visuals.get(norm_id, [])

    def ingest_sensor_readings(
        self, readings: List[SensorReading]
    ) -> Tuple[DiagnosisResult, Optional[Notification]]:
        if not readings:
            raise ValueError("No sensor readings provided")

        now = get_current_iso_time()
        primary_zone = self._normalize_zone_id(readings[0].zone_id)

        # Update zone sensor cache
        current_readings = {r.metric: r for r in self.zone_sensors.get(primary_zone, [])}
        for r in readings:
            r.zone_id = primary_zone
            current_readings[r.metric] = r
        self.zone_sensors[primary_zone] = list(current_readings.values())

        # Multimodal fusion
        prev_diag = self.zone_diagnoses.get(primary_zone)
        prev_risk = prev_diag.diagnosis.risk_level if prev_diag else RiskLevel.HEALTHY

        new_diag = fusion_engine.fuse_zone_evidence(
            zone_id=primary_zone,
            sensor_readings=self.zone_sensors[primary_zone],
            visual_evidence=self.zone_visuals.get(primary_zone, []),
        )
        self.zone_diagnoses[primary_zone] = new_diag

        # Update Zone entity
        if primary_zone in self.zones:
            self.zones[primary_zone].current_risk = new_diag.diagnosis.risk_level
            self.zones[primary_zone].last_updated = now

        # Also sync to legacy field cleanly
        legacy_field_id = self._zone_to_field_id(primary_zone)
        sm = next((r.value for r in readings if "moisture" in r.metric.lower()), 46.0)
        temp = next((r.value for r in readings if "temp" in r.metric.lower()), 30.0)
        hum = next((r.value for r in readings if "hum" in r.metric.lower()), 58.0)
        pest = next((r.value for r in readings if "pest" in r.metric.lower()), 10.0)
        rain = next((r.value for r in readings if "rain" in r.metric.lower()), 0.0)

        updated_field, field_notif = self.update_field_telemetry(
            field_id=legacy_field_id,
            soil_moisture=sm,
            temperature=temp,
            humidity=hum,
            rainfall_mm=rain,
            pest_level=pest,
        )

        # Create alert if risk elevated (avoid spamming identical consecutive notifications)
        notif = None
        if new_diag.diagnosis.risk_level in [RiskLevel.ATTENTION, RiskLevel.ACTION_REQUIRED] and prev_risk != new_diag.diagnosis.risk_level:
            sev = NotificationSeverity.CRITICAL if new_diag.diagnosis.risk_level == RiskLevel.ACTION_REQUIRED else NotificationSeverity.WARNING
            notif = Notification(
                id=f"notif-{primary_zone}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                farm_id=self.farm.id,
                field_id=primary_zone,
                severity=sev,
                type=NotificationType.WATER_STRESS if "water" in new_diag.diagnosis.condition else NotificationType.DISEASE,
                title=f"{new_diag.diagnosis.risk_level.value.replace('_', ' ')}: {new_diag.diagnosis.condition.replace('_', ' ').title()} in Zone {primary_zone}",
                message=new_diag.recommendation.reason or "Elevated agricultural risk detected.",
                status=NotificationState.ACTIVE,
                recommendation=new_diag.recommendation.action,
                created_at=now,
                updated_at=now,
                metadata=NotificationMetadata(
                    metric="soil_moisture",
                    value=sm,
                    unit="%",
                    previous_status=risk_level_to_status_str(prev_risk),
                    current_status=risk_level_to_status_str(new_diag.diagnosis.risk_level),
                    risk_type=RiskType.WATER_STRESS,
                ),
            )
            self.notifications.insert(0, notif)

        return new_diag, notif or field_notif

    def run_inference_for_zone(
        self, request: InferenceRequest
    ) -> Tuple[List[VisualEvidence], DiagnosisResult, Optional[Notification], str, Optional[str], int]:
        zone_id = self._normalize_zone_id(request.zone_id)
        request.zone_id = zone_id

        prev_diag = self.zone_diagnoses.get(zone_id)
        prev_condition = prev_diag.diagnosis.condition if prev_diag else None
        prev_risk = prev_diag.diagnosis.risk_level if prev_diag else RiskLevel.HEALTHY

        # 1. Run ML Adapter with Roboflow / Demo support
        outcome = ml_adapter.run_inference_detailed(request)
        evidences = outcome.evidences
        self.zone_visuals[zone_id] = evidences
        now = get_current_iso_time()

        # 2. Run Multimodal Fusion with existing sensors + new visual evidence
        sensors = self.zone_sensors.get(zone_id, [])
        diag = fusion_engine.fuse_zone_evidence(
            zone_id=zone_id,
            sensor_readings=sensors,
            visual_evidence=evidences,
        )
        self.zone_diagnoses[zone_id] = diag

        # 3. Update Zone entity
        if zone_id in self.zones:
            self.zones[zone_id].current_risk = diag.diagnosis.risk_level
            self.zones[zone_id].last_updated = now

        # 4. Update legacy vision detections & synchronize mapped FPO Admin Field
        has_disease = any(e.detected and e.type not in ["healthy_canopy"] for e in evidences)
        disease_name = next(
            (diag.diagnosis.condition.replace("_", " ").title() for e in evidences if e.detected and e.type not in ["healthy_canopy"]),
            None,
        )
        highest_conf = max((e.confidence for e in evidences), default=0.0)

        legacy_id = self._zone_to_field_id(zone_id)
        self.vision_detections[legacy_id] = VisionDetectionResult(
            detected=has_disease,
            disease=disease_name,
            confidence=round(highest_conf, 2),
        )
        self._sync_zone_to_field(zone_id, diag, evidences)

        notif = None
        if diag.diagnosis.risk_level in [RiskLevel.ACTION_REQUIRED, RiskLevel.ATTENTION]:
            expected_title = f"{diag.diagnosis.condition.replace('_', ' ').title()} identified in Zone {zone_id}"
            already_active = any(
                n.status == NotificationState.ACTIVE and n.title == expected_title and n.field_id == zone_id
                for n in self.notifications
            )
            if not already_active and (prev_condition != diag.diagnosis.condition or prev_risk != diag.diagnosis.risk_level):
                sev = NotificationSeverity.CRITICAL if diag.diagnosis.risk_level == RiskLevel.ACTION_REQUIRED else NotificationSeverity.WARNING
                notif = Notification(
                    id=f"notif-vision-{zone_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                    farm_id=self.farm.id,
                    field_id=zone_id,
                    severity=sev,
                    type=NotificationType.DISEASE,
                    title=expected_title,
                    message=diag.recommendation.reason or "Visual evidence corroborated by environmental conditions.",
                    status=NotificationState.ACTIVE,
                    recommendation=diag.recommendation.action,
                    created_at=now,
                    updated_at=now,
                )
                self.notifications.insert(0, notif)

        return evidences, diag, notif, outcome.provider, outcome.provider_note, outcome.frames_processed

    def _sync_zone_to_field(
        self,
        zone_id: str,
        diag: DiagnosisResult,
        evidences: List[VisualEvidence],
    ) -> Optional[Field]:
        """Keeps FPO/Admin Field entities synchronized with Farmer App Zone updates."""
        field_id = self._zone_to_field_id(zone_id)
        current_field = self.fields.get(field_id)
        if not current_field:
            return None

        now = get_current_iso_time()
        mapped_status = risk_level_to_status_str(diag.diagnosis.risk_level)
        if mapped_status == "critical":
            status_enum = Status.CRITICAL
            health_score = 54.0
            health_cond = CropHealthCondition.SEVERELY_STRESSED
            conf_pct = 92.0
        elif mapped_status == "warning":
            status_enum = Status.WARNING
            health_score = 72.0
            health_cond = CropHealthCondition.STRESSED
            conf_pct = 89.0
        elif mapped_status == "advisory":
            status_enum = Status.ADVISORY
            health_score = 81.0
            health_cond = CropHealthCondition.AT_RISK
            conf_pct = 82.0
        else:
            status_enum = Status.NORMAL
            health_score = 94.0
            health_cond = CropHealthCondition.HEALTHY
            conf_pct = 95.0

        condition_title = diag.diagnosis.condition.replace("_", " ").title()
        risk_type = RiskType.WATER_STRESS if "water" in diag.diagnosis.condition or "drought" in diag.diagnosis.condition else (
            RiskType.NONE if status_enum == Status.NORMAL else RiskType.DISEASE
        )

        indicators = [
            AssessmentIndicator(
                id=f"vis-{ev.type}",
                label=f"Canopy Vision: {ev.type.replace('_', ' ').title()}",
                value=f"{round(ev.confidence * 100)}%",
                contribution="high" if ev.detected and ev.type != "healthy_canopy" else "low",
            )
            for ev in evidences[:2]
        ]
        for sr in diag.sensor_evidence[:2]:
            indicators.append(
                AssessmentIndicator(
                    id=f"sen-{sr.metric}",
                    label=sr.metric.replace("_", " ").title(),
                    value=f"{sr.value:.1f}{sr.unit}",
                    contribution="high" if status_enum in [Status.CRITICAL, Status.WARNING] else "low",
                )
            )

        updated_field = Field(
            id=current_field.id,
            farm_id=current_field.farm_id,
            name=current_field.name,
            crop=current_field.crop,
            area_acres=current_field.area_acres,
            status=status_enum,
            crop_health=CropHealth(score=health_score, condition=health_cond, status=status_enum),
            environmental=current_field.environmental,
            water=current_field.water,
            risk=RiskAssessment(
                type=risk_type,
                status=status_enum,
                title=condition_title if status_enum != Status.NORMAL else "Optimal Growing Conditions",
                description=diag.recommendation.reason or "Multimodal telemetry & vision assessment.",
                detected_at=now if status_enum != Status.NORMAL else None,
            ),
            ai_assessment=AIAssessment(
                title=condition_title,
                summary=diag.recommendation.reason or f"Multimodal fusion assessment for Zone {zone_id} ({current_field.name}).",
                confidence_percent=conf_pct,
                indicators=indicators or current_field.ai_assessment.indicators,
                model=ModelInfo(name="RhizoSense Multimodal Fusion V2", version="2.0.0", inference_type="vision_plus_telemetry"),
                generated_at=now,
            ),
            recommendation=Recommendation(
                id=f"rec-{field_id}-live",
                title=f"Action for {current_field.name} (Zone {zone_id})",
                action=diag.recommendation.action,
                reason=diag.recommendation.reason or "Corroborated by multimodal fusion.",
                priority=status_enum,
                generated_at=now,
                reviewed=False,
            ),
            last_updated=now,
        )
        self.fields[field_id] = updated_field
        self._append_telemetry_point(field_id, MetricType.CROP_HEALTH, health_score, now)
        self._append_telemetry_point(field_id, MetricType.DISEASE_RISK, 85.0 if status_enum == Status.CRITICAL else (60.0 if status_enum == Status.WARNING else 12.0), now)
        self.farm.updated_at = now
        self.edge_system.updated_at = now
        self.edge_system.last_inference_at = now
        return updated_field

    def acknowledge_zone_action(
        self,
        zone_id: str,
        action_taken: str,
        recommendation_id: Optional[str] = None,
    ) -> Tuple[Optional[Zone], Optional[Field], List[str]]:
        """Marks zone/field recommendation reviewed and resolves active alerts across both apps."""
        norm_zone = self._normalize_zone_id(zone_id)
        mapped_field_id = self._zone_to_field_id(norm_zone)
        now = get_current_iso_time()

        updated_field = None
        if recommendation_id:
            updated_field = self.mark_recommendation_reviewed(recommendation_id)
        if not updated_field and mapped_field_id in self.fields:
            f = self.fields[mapped_field_id]
            if f.recommendation:
                f.recommendation.reviewed = True
                f.recommendation.reviewed_at = now
                f.last_updated = now
                updated_field = f

        resolved_ids: List[str] = []
        for n in self.notifications:
            if n.status == NotificationState.ACTIVE and n.field_id in [norm_zone, mapped_field_id]:
                n.status = NotificationState.RESOLVED
                n.resolved_at = now
                n.updated_at = now
                resolved_ids.append(n.id)

        zone_obj = self.zones.get(norm_zone)
        if zone_obj:
            zone_obj.last_updated = now

        return zone_obj, updated_field, resolved_ids


    def reconcile_sync_records(self, records: List[SyncRecord]) -> Dict[str, Any]:
        """
        Reconciles offline queued farmer actions/diagnoses with cloud backend.
        """
        now = get_current_iso_time()
        processed = 0
        for rec in records:
            rec.sync_status = SyncStatus.SYNCED
            self.sync_records.append(rec)
            processed += 1

            # Handle farmer recommendation acknowledgment
            if rec.event_type in ["farmer_ack", "recommendation_reviewed"]:
                rec_id = rec.payload.get("recommendation_id")
                if rec_id:
                    self.mark_recommendation_reviewed(rec_id)
            elif rec.event_type == "alert_resolved":
                notif_id = rec.payload.get("notification_id")
                if notif_id:
                    self.resolve_notification(notif_id)

        return {
            "status": "synchronized",
            "records_processed": processed,
            "timestamp": now,
        }

    def _zone_to_field_id(self, zone_id: str) -> str:
        norm = (zone_id or "").upper().strip()
        mapping = {
            "B3": "field-c",
            "FIELD-C": "field-c",
            "A1": "field-a",
            "FIELD-A": "field-a",
            "A2": "field-b",
            "FIELD-B": "field-b",
            "C3": "field-d",
            "FIELD-D": "field-d",
            "D4": "field-e",
            "FIELD-E": "field-e",
            "E5": "field-f",
            "FIELD-F": "field-f",
        }
        return mapping.get(norm, "field-c")

    def _normalize_zone_id(self, raw_id: str) -> str:
        clean = (raw_id or "").upper().strip()
        if clean in ["FIELD-C", "C", "FIELD_C"]:
            return "B3"
        elif clean in ["FIELD-A", "A", "FIELD_A"]:
            return "A1"
        elif clean in ["FIELD-B", "B", "FIELD_B"]:
            return "A2"
        elif clean in ["FIELD-D", "D", "FIELD_D"]:
            return "C3"
        elif clean in ["FIELD-E", "E", "FIELD_E"]:
            return "D4"
        elif clean in ["FIELD-F", "F", "FIELD_F"]:
            return "E5"
        return clean if clean in self.zones else "B3"

    # Legacy Compatibility Methods
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
        if field_id in self.fields:
            return self.fields[field_id]
        if field_id.upper() in self.zones:
            # Map zone to field-c format
            return self.fields.get("field-c")
        return None

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
        mapped_id = field_id
        if field_id.upper() in ["B3", "FIELD-C"]:
            mapped_id = "field-c"
        elif field_id not in self.fields:
            mapped_id = "field-c"

        current_field = self.fields[mapped_id]
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
            field_id=mapped_id,
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
            id=mapped_id,
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
        self.fields[mapped_id] = updated_field

        # Append telemetry point to history
        self._append_telemetry_point(mapped_id, MetricType.SOIL_MOISTURE, soil_moisture, now)
        self._append_telemetry_point(mapped_id, MetricType.TEMPERATURE, temperature, now)
        self._append_telemetry_point(mapped_id, MetricType.HUMIDITY, humidity, now)
        self._append_telemetry_point(mapped_id, MetricType.CROP_HEALTH, crop_health.score, now)
        self._append_telemetry_point(mapped_id, MetricType.PEST_ACTIVITY, pest_level, now)
        self._append_telemetry_point(mapped_id, MetricType.DISEASE_RISK, disease_index, now)

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

        target_id = field_id
        if field_id not in self.history:
            target_id = "field-c"

        for m in metrics[:3]:
            points = self.history.get(target_id, {}).get(m, {}).get(period, [])
            series_list.append(
                MetricSeries(
                    field_id=target_id,
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

        # Keep canonical zone visuals and diagnosis in sync when triggered from Admin Field Detail
        norm_zone = self._normalize_zone_id(field_id)
        now = get_current_iso_time()
        ev_type = "healthy_canopy"
        if detection.detected:
            d_low = (detection.disease or "").lower()
            if "rot" in d_low or "wilt" in d_low:
                ev_type = "rhizome_discoloration"
            elif "dry" in d_low or "necrosis" in d_low:
                ev_type = "necrosis"
            else:
                ev_type = "leaf_spots"

        ev = VisualEvidence(
            type=ev_type,
            detected=detection.detected,
            confidence=detection.confidence,
            source="edge_vision_sync",
            details=f"{detection.disease or 'Healthy canopy'} evaluated via Edge Vision panel.",
        )
        self.zone_visuals[norm_zone] = [ev]
        diag = fusion_engine.fuse_zone_evidence(
            zone_id=norm_zone,
            sensor_readings=self.zone_sensors.get(norm_zone, []),
            visual_evidence=[ev],
        )
        self.zone_diagnoses[norm_zone] = diag
        if norm_zone in self.zones:
            self.zones[norm_zone].current_risk = diag.diagnosis.risk_level
            self.zones[norm_zone].last_updated = now
        self._sync_zone_to_field(norm_zone, diag, [ev])

        notif = None
        if not prev.detected and detection.detected:
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


state_manager = FarmStateManager()
