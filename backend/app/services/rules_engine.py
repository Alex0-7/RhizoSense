from datetime import datetime, timezone
from typing import Tuple

from backend.app.schemas.enums import (
    Status,
    CropHealthCondition,
    RiskType,
    NotificationSeverity,
    NotificationState,
    NotificationType,
    IrrigationStatus,
)
from backend.app.schemas.models import (
    CropHealth,
    RiskState,
    RiskAssessment,
    FieldEnvironment,
    FieldWaterState,
    AIAssessment,
    AssessmentIndicator,
    ModelInfo,
    Recommendation,
    Notification,
    NotificationMetadata,
)


def get_current_iso_time() -> str:
    return datetime.now(timezone.utc).isoformat()


def evaluate_field_condition(
    field_id: str,
    farm_id: str,
    soil_moisture: float,
    temperature: float,
    humidity: float,
    rainfall_mm: float = 0.0,
    pest_level: float = 10.0,
    disease_index: float = 15.0,
    previous_status: Status | None = None,
) -> Tuple[
    Status,
    CropHealth,
    FieldEnvironment,
    FieldWaterState,
    RiskAssessment,
    AIAssessment,
    Recommendation,
    Notification | None,
]:
    now = get_current_iso_time()

    # 1. Soil moisture and water stress
    if soil_moisture < 20.0:
        water_status = Status.CRITICAL
        water_stress = 85.0
        irrigation_needed = True
        irrigation_status = IrrigationStatus.URGENT
        drought_status = Status.CRITICAL
        drought_label = "Severe drought risk"
    elif soil_moisture < 30.0:
        water_status = Status.WARNING
        water_stress = 55.0
        irrigation_needed = True
        irrigation_status = IrrigationStatus.RECOMMENDED
        drought_status = Status.WARNING
        drought_label = "Elevated drought risk"
    elif soil_moisture < 40.0:
        water_status = Status.ADVISORY
        water_stress = 30.0
        irrigation_needed = True
        irrigation_status = IrrigationStatus.RECOMMENDED
        drought_status = Status.ADVISORY
        drought_label = "Moderate moisture deficit"
    elif soil_moisture > 85.0:
        water_status = Status.CRITICAL
        water_stress = 10.0
        irrigation_needed = False
        irrigation_status = IrrigationStatus.NOT_REQUIRED
        drought_status = Status.NORMAL
        drought_label = "Low drought risk"
    elif soil_moisture > 75.0:
        water_status = Status.WARNING
        water_stress = 10.0
        irrigation_needed = False
        irrigation_status = IrrigationStatus.NOT_REQUIRED
        drought_status = Status.NORMAL
        drought_label = "Low drought risk"
    else:
        water_status = Status.NORMAL
        water_stress = 10.0
        irrigation_needed = False
        irrigation_status = IrrigationStatus.NOT_REQUIRED
        drought_status = Status.NORMAL
        drought_label = "Optimal soil moisture"

    # 2. Flood / Waterlogging risk
    if soil_moisture > 85.0 or rainfall_mm > 50.0:
        flood_status = Status.CRITICAL
        flood_label = "Severe flood/waterlogging risk"
    elif soil_moisture > 75.0 or rainfall_mm > 25.0:
        flood_status = Status.WARNING
        flood_label = "Elevated surface water risk"
    elif soil_moisture > 68.0 or rainfall_mm > 10.0:
        flood_status = Status.ADVISORY
        flood_label = "Moderate moisture accumulation"
    else:
        flood_status = Status.NORMAL
        flood_label = "Low flood risk"

    # 3. Heat Stress
    if temperature >= 40.0:
        heat_status = Status.CRITICAL
        heat_label = "Extreme heat stress"
    elif temperature >= 35.0:
        heat_status = Status.WARNING
        heat_label = "Elevated heat stress"
    elif temperature >= 32.0:
        heat_status = Status.ADVISORY
        heat_label = "Mild heat stress"
    else:
        heat_status = Status.NORMAL
        heat_label = "Optimal temperature"

    # 4. Pest Risk
    if pest_level >= 70.0:
        pest_status = Status.CRITICAL
        pest_label = "Severe pest infestation"
    elif pest_level >= 45.0:
        pest_status = Status.WARNING
        pest_label = "Elevated pest activity"
    elif pest_level >= 25.0:
        pest_status = Status.ADVISORY
        pest_label = "Mild pest presence"
    else:
        pest_status = Status.NORMAL
        pest_label = "Low pest activity"

    # 5. Disease Weather
    if humidity >= 80.0 and 22.0 <= temperature <= 32.0:
        disease_status = Status.WARNING
        disease_label = "High disease-favorable weather"
    elif humidity >= 70.0 and 20.0 <= temperature <= 34.0:
        disease_status = Status.ADVISORY
        disease_label = "Moderate fungal risk"
    else:
        disease_status = Status.NORMAL
        disease_label = "Low disease-favorable weather"

    # Determine overall highest status
    all_statuses = [water_status, drought_status, flood_status, heat_status, pest_status, disease_status]
    if Status.CRITICAL in all_statuses:
        overall_status = Status.CRITICAL
    elif Status.WARNING in all_statuses:
        overall_status = Status.WARNING
    elif Status.ADVISORY in all_statuses:
        overall_status = Status.ADVISORY
    else:
        overall_status = Status.NORMAL

    # Calculate crop health
    base_health = 92.0
    if water_status == Status.CRITICAL:
        base_health -= 30.0
    elif water_status == Status.WARNING:
        base_health -= 15.0
    elif water_status == Status.ADVISORY:
        base_health -= 5.0

    if heat_status == Status.CRITICAL:
        base_health -= 20.0
    elif heat_status == Status.WARNING:
        base_health -= 10.0

    if pest_status == Status.CRITICAL:
        base_health -= 25.0
    elif pest_status == Status.WARNING:
        base_health -= 12.0

    if flood_status == Status.CRITICAL:
        base_health -= 20.0
    elif flood_status == Status.WARNING:
        base_health -= 10.0

    health_score = max(20.0, min(100.0, base_health))

    if health_score < 65.0:
        crop_condition = CropHealthCondition.SEVERELY_STRESSED
        crop_status = Status.CRITICAL
    elif health_score < 75.0:
        crop_condition = CropHealthCondition.STRESSED
        crop_status = Status.WARNING
    elif health_score < 85.0:
        crop_condition = CropHealthCondition.AT_RISK
        crop_status = Status.ADVISORY
    else:
        crop_condition = CropHealthCondition.HEALTHY
        crop_status = Status.NORMAL

    crop_health = CropHealth(
        score=round(health_score, 1),
        condition=crop_condition,
        status=crop_status,
    )

    # Primary risk assessment identification
    if flood_status == Status.CRITICAL:
        primary_risk_type = RiskType.FLOOD
        risk_title = "Severe Waterlogging & Flood Risk"
        risk_desc = f"Soil moisture at {soil_moisture:.1f}% exceeds safe saturation threshold with elevated root asphyxiation risk."
    elif water_status == Status.CRITICAL:
        primary_risk_type = RiskType.WATER_STRESS
        risk_title = "Severe Water Stress"
        risk_desc = f"Soil moisture at {soil_moisture:.1f}% is critically low. Rapid root dehydration detected."
    elif pest_status == Status.CRITICAL:
        primary_risk_type = RiskType.PEST
        risk_title = "Critical Pest Outbreak"
        risk_desc = f"Pest activity index reached {pest_level:.1f}%, indicating active foliage damage."
    elif heat_status == Status.CRITICAL:
        primary_risk_type = RiskType.HEAT
        risk_title = "Extreme Heat Stress"
        risk_desc = f"Ambient canopy temperature reached {temperature:.1f}°C, triggering thermal stomatal closure."
    elif water_status == Status.WARNING:
        primary_risk_type = RiskType.WATER_STRESS
        risk_title = "Moderate Water Stress"
        risk_desc = f"Soil moisture declining at {soil_moisture:.1f}%. Crop approaching permanent wilting threshold."
    elif pest_status == Status.WARNING:
        primary_risk_type = RiskType.PEST
        risk_title = "Elevated Pest Pressure"
        risk_desc = f"Pest activity index is {pest_level:.1f}%. Immediate scouting warranted."
    elif heat_status == Status.WARNING:
        primary_risk_type = RiskType.HEAT
        risk_title = "Elevated Heat Stress"
        risk_desc = f"Temperature elevated at {temperature:.1f}°C with transpiration stress."
    elif disease_status == Status.WARNING:
        primary_risk_type = RiskType.DISEASE
        risk_title = "Favorable Pathogen Weather"
        risk_desc = f"High humidity ({humidity:.1f}%) and ambient heat create conditions favorable for fungal blights."
    else:
        primary_risk_type = RiskType.NONE
        risk_title = "Optimal Growing Conditions"
        risk_desc = "All environmental, soil, and physiological indicators are within normal parameters."

    risk_assessment = RiskAssessment(
        type=primary_risk_type,
        status=overall_status,
        title=risk_title,
        description=risk_desc,
        detected_at=now if overall_status != Status.NORMAL else None,
    )

    # Environmental sub-model
    environmental = FieldEnvironment(
        temperature_c=round(temperature, 1),
        humidity_percent=round(humidity, 1),
        heat_stress=RiskState(type=RiskType.HEAT, status=heat_status, level=round(temperature, 1), label=heat_label),
        drought_risk=RiskState(type=RiskType.DROUGHT, status=drought_status, level=round(water_stress, 1), label=drought_label),
        flood_risk=RiskState(type=RiskType.FLOOD, status=flood_status, level=round(soil_moisture, 1), label=flood_label),
        disease_weather=RiskState(type=RiskType.DISEASE, status=disease_status, level=round(humidity, 1), label=disease_label),
        rainfall_mm=round(rainfall_mm, 1),
        updated_at=now,
    )

    # Water sub-model
    water = FieldWaterState(
        soil_moisture_percent=round(soil_moisture, 1),
        water_stress_percent=round(water_stress, 1),
        irrigation_needed=irrigation_needed,
        irrigation_status=irrigation_status,
        water_consumption_liters=round(120.0 + (35.0 - soil_moisture) * 4.0, 1),
        updated_at=now,
    )

    # AI Assessment & Indicators
    indicators = [
        AssessmentIndicator(
            id="soil-moisture",
            label="Volumetric Soil Moisture",
            value=f"{soil_moisture:.1f}%",
            contribution="high" if water_status in [Status.CRITICAL, Status.WARNING] else "low",
        ),
        AssessmentIndicator(
            id="temperature",
            label="Canopy Temperature",
            value=f"{temperature:.1f}°C",
            contribution="high" if heat_status in [Status.CRITICAL, Status.WARNING] else "medium",
        ),
        AssessmentIndicator(
            id="humidity",
            label="Ambient Humidity",
            value=f"{humidity:.1f}%",
            contribution="high" if disease_status in [Status.CRITICAL, Status.WARNING] else "low",
        ),
    ]
    if pest_level > 25.0:
        indicators.append(
            AssessmentIndicator(
                id="pest-sensor",
                label="Acoustic & Vision Pest Activity",
                value=f"{pest_level:.0f}%",
                contribution="high" if pest_status in [Status.CRITICAL, Status.WARNING] else "medium",
            )
        )

    confidence = 94.0 if overall_status == Status.CRITICAL else (89.0 if overall_status == Status.WARNING else 91.0)
    ai_assessment = AIAssessment(
        title=risk_title,
        summary=f"Edge AI inference indicates {risk_title.lower()} with physiological impact on crop resilience.",
        confidence_percent=confidence,
        indicators=indicators,
        model=ModelInfo(
            name="RhizoSense Edge Crop Intelligence",
            version="1.2.0",
            inference_type="multi_modal_crop_risk",
        ),
        generated_at=now,
    )

    # Actionable Recommendation
    field_display_name = field_id.replace("-", " ").title()
    if flood_status == Status.CRITICAL:
        rec_title = f"Drain {field_display_name}"
        rec_action = f"Cease all irrigation immediately and open drainage channels in {field_display_name}."
        rec_reason = f"Soil moisture ({soil_moisture:.1f}%) exceeds saturation limits."
    elif water_status == Status.CRITICAL:
        rec_title = f"Irrigate {field_display_name} Immediately"
        rec_action = f"Irrigate {field_display_name} immediately via drip irrigation zone at 15 L/sq.m."
        rec_reason = f"Soil moisture ({soil_moisture:.1f}%) is below the critical threshold (20%) while temperature is {temperature:.1f}°C."
    elif pest_status == Status.CRITICAL:
        rec_title = f"Deploy Pest Control in {field_display_name}"
        rec_action = f"Apply targeted bio-pesticide spray in {field_display_name} and inspect leaf undersides."
        rec_reason = f"Automated trap sensors confirm active pest activity index at {pest_level:.0f}%."
    elif heat_status == Status.CRITICAL:
        rec_title = f"Deploy Heat Mitigation for {field_display_name}"
        rec_action = f"Deploy shading nets or micro-misting in {field_display_name} to lower canopy temperature."
        rec_reason = f"Canopy temperature ({temperature:.1f}°C) exceeds photosynthetic threshold."
    elif water_status == Status.WARNING:
        rec_title = f"Schedule Irrigation for {field_display_name}"
        rec_action = f"Schedule irrigation cycle within 3 hours for {field_display_name}."
        rec_reason = f"Soil moisture has declined to {soil_moisture:.1f}% with elevated transpiration."
    elif pest_status == Status.WARNING:
        rec_title = f"Inspect {field_display_name} for Pest Infiltration"
        rec_action = f"Conduct physical field scouting and clean pheromone monitoring traps."
        rec_reason = f"Pest density index elevated to {pest_level:.0f}%."
    else:
        rec_title = f"Maintain Standard Schedule"
        rec_action = f"Continue standard soil telemetry monitoring for {field_display_name}."
        rec_reason = "All crop physiology and moisture levels remain optimal."

    recommendation = Recommendation(
        id=f"rec-{field_id}-live",
        title=rec_title,
        action=rec_action,
        reason=rec_reason,
        priority=overall_status,
        generated_at=now,
        reviewed=False,
    )

    # Notification Generation logic (generate on meaningful transition or critical state)
    notification = None
    if previous_status != overall_status and overall_status in [Status.WARNING, Status.CRITICAL]:
        severity = NotificationSeverity.CRITICAL if overall_status == Status.CRITICAL else NotificationSeverity.WARNING
        notif_type = (
            NotificationType.WATER_STRESS if primary_risk_type == RiskType.WATER_STRESS
            else NotificationType.FLOOD if primary_risk_type == RiskType.FLOOD
            else NotificationType.PEST if primary_risk_type == RiskType.PEST
            else NotificationType.HEAT_STRESS if primary_risk_type == RiskType.HEAT
            else NotificationType.CROP_HEALTH
        )
        notif_title = f"{overall_status.value.capitalize()}: {risk_title} in {field_display_name}"
        notif_msg = f"{risk_desc} Recommended action: {rec_action}"

        notification = Notification(
            id=f"notif-{field_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            farm_id=farm_id,
            field_id=field_id,
            severity=severity,
            type=notif_type,
            title=notif_title,
            message=notif_msg,
            status=NotificationState.ACTIVE,
            recommendation=rec_action,
            created_at=now,
            updated_at=now,
            metadata=NotificationMetadata(
                metric="soil_moisture" if primary_risk_type == RiskType.WATER_STRESS else "temperature",
                value=round(soil_moisture if primary_risk_type == RiskType.WATER_STRESS else temperature, 1),
                unit="%" if primary_risk_type == RiskType.WATER_STRESS else "°C",
                previous_status=previous_status,
                current_status=overall_status,
                risk_type=primary_risk_type,
            ),
        )

    return (
        overall_status,
        crop_health,
        environmental,
        water,
        risk_assessment,
        ai_assessment,
        recommendation,
        notification,
    )
