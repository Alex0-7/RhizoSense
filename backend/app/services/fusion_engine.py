from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple

from backend.app.schemas.canonical import (
    Zone,
    VisualEvidence,
    SensorReading,
    EnvironmentalMatch,
    Advisory,
    DiagnosisCore,
    DiagnosisResult,
    RiskLevel,
    ConfidenceTier,
    confidence_float_to_tier,
)


def get_iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class MultimodalFusionEngine:
    """
    Deterministic Multimodal Fusion & Risk Engine for RhizoSense V2.
    Fuses:
      - Visual evidence (leaf symptoms, necrosis, wilting, discoloration)
      - Sensor readings (soil moisture, temperature, humidity, rainfall, pest level)
      - Environmental context windows
    Produces:
      - Canonical DiagnosisResult (What, Why, Action, localized Voice)
    """

    @staticmethod
    def fuse_zone_evidence(
        zone_id: str,
        sensor_readings: List[SensorReading],
        visual_evidence: Optional[List[VisualEvidence]] = None,
        environmental_context: Optional[Dict[str, float]] = None,
        crop: str = "Tomato",
    ) -> DiagnosisResult:
        now = get_iso_now()
        visual_evidence = visual_evidence or []

        # 1. Parse Sensor Evidence into a lookup
        sensors: Dict[str, float] = {}
        for r in sensor_readings:
            sensors[r.metric.lower().strip()] = r.value

        soil_moisture = sensors.get("soil_moisture", 50.0)
        temp = sensors.get("temperature", sensors.get("soil_temperature", 28.0))
        humidity = sensors.get("humidity", 60.0)
        rainfall = sensors.get("rainfall_mm", 0.0)
        pest_level = sensors.get("pest_level", 10.0)

        # 2. Evaluate Environmental Window
        # High humidity (>= 75%) and warm temp (22 - 34°C) favor fungal pathogens
        pathogen_weather = humidity >= 75.0 and (22.0 <= temp <= 34.0)
        env_matched = False
        env_reason = "Environmental conditions are within standard physiological ranges."

        if pathogen_weather:
            env_matched = True
            env_reason = (
                f"Ambient humidity at {humidity:.1f}% combined with temperature at {temp:.1f}°C "
                f"creates a microclimate highly favorable for pathogen proliferation."
            )
        elif temp >= 38.0:
            env_matched = True
            env_reason = f"Canopy heat index at {temp:.1f}°C induces severe stomatal closure and transpiration shock."
        elif rainfall > 30.0 or soil_moisture > 85.0:
            env_matched = True
            env_reason = f"Saturated root zone ({soil_moisture:.1f}% moisture) with recent rainfall ({rainfall:.1f} mm) limits root aeration."

        environmental_match = EnvironmentalMatch(
            matched=env_matched,
            reason=env_reason,
        )

        # 3. Check for Visual Evidence Detections
        active_visuals = [v for v in visual_evidence if v.detected and v.confidence >= 0.40]
        has_visual_disease = False
        highest_visual_conf = 0.0
        primary_symptom = None

        for v in active_visuals:
            if v.type in ["wilting", "necrosis", "leaf_spots", "rhizome_discoloration", "yellowing"]:
                has_visual_disease = True
                if v.confidence > highest_visual_conf:
                    highest_visual_conf = v.confidence
                    primary_symptom = v.type

        # 4. Multimodal Fusion Logic
        # Case A: Visual symptom + High Soil Moisture / Fungal Window -> Rhizome Rot / Root Rot / Leaf Blotch
        if has_visual_disease and (soil_moisture > 75.0 or pathogen_weather):
            is_blotch = any("blotch" in (v.details or "").lower() or "blotch" in v.type.lower() for v in visual_evidence)
            if primary_symptom in ["wilting", "rhizome_discoloration"]:
                condition = "rhizome_rot"
            elif is_blotch:
                condition = "leaf_blotch"
            else:
                condition = "early_blight"

            risk_level = RiskLevel.ACTION_REQUIRED if (soil_moisture > 80.0 or highest_visual_conf >= 0.75) else RiskLevel.ATTENTION
            confidence = ConfidenceTier.HIGH if (highest_visual_conf >= 0.75 and env_matched) else ConfidenceTier.MEDIUM

            if condition == "rhizome_rot":
                action = "Halt all irrigation cycles immediately and aerate surface soil."
                secondary_action = "Inspect root collar and apply biological Trichoderma drench to perimeter."
                reason = (
                    f"Visual detection of {primary_symptom} (confidence {highest_visual_conf:.0%}) combined with saturated "
                    f"soil moisture ({soil_moisture:.1f}%) and disease-favorable humidity ({humidity:.1f}%)."
                )
                voice_en = f"Action required in Zone {zone_id}. Root rot risk detected due to soil saturation. Halt irrigation immediately."
                voice_ta = f"மண்டலம் {zone_id} இல் நடவடிக்கை தேவை. அதிக ஈரப்பதத்தால் வேரழுகல் ஆபத்து. உடனடியாக பாசனத்தை நிறுத்தவும்."
                voice_hi = f"जोन {zone_id} में तत्काल कार्रवाई आवश्यक है। अधिक नमी के कारण जड़ सड़न का खतरा। तुरंत सिंचाई रोकें।"
            elif condition == "leaf_blotch":
                action = "Apply targeted Mancozeb (0.25%) or bio-fungicidal spray to canopy leaves."
                secondary_action = "Prune infected lower foliage to prevent horizontal spore dispersion."
                reason = (
                    f"Visual detection of turmeric leaf blotch (confidence {highest_visual_conf:.0%}) aligned with pathogen-conducive "
                    f"weather window ({humidity:.1f}% humidity, {temp:.1f}°C)."
                )
                voice_en = f"Attention in Zone {zone_id}. Turmeric leaf blotch spots identified. Apply targeted bio-fungicide spray."
                voice_ta = f"மண்டலம் {zone_id} இல் கவனம் தேவை. மஞ்சள் பயிரில் இலைப்புள்ளி நோய் அறிகுறிகள். பூஞ்சாணக்கொல்லி தெளிக்கவும்."
                voice_hi = f"जोन {zone_id} में ध्यान दें। हल्दी की पत्ती पर धब्बे के लक्षण मिले हैं। अनुशंसित कवकनाशी का छिड़काव करें।"
            else:
                action = "Apply targeted bio-fungicidal spray to lower and middle canopy leaves."
                secondary_action = "Prune infected foliage to prevent horizontal spore dispersion."
                reason = (
                    f"Visual detection of {primary_symptom} (confidence {highest_visual_conf:.0%}) aligned with pathogen-conducive "
                    f"weather window ({humidity:.1f}% humidity, {temp:.1f}°C)."
                )
                voice_en = f"Attention in Zone {zone_id}. Early blight foliage spots identified. Apply targeted bio-fungicide spray."
                voice_ta = f"மண்டலம் {zone_id} இல் கவனம் தேவை. ஆரம்பகால இலைக்கருகல் நோய் அறிகுறிகள். பூஞ்சாணக்கொல்லி தெளிக்கவும்."
                voice_hi = f"जोन {zone_id} में ध्यान दें। अगेती झुलसा के लक्षण मिले हैं। अनुशंसित फफूंदनाशक का छिड़काव करें।"


        # Case B: Visual symptom + Low Moisture -> Severe Water Stress / Drought Shock
        elif has_visual_disease and (soil_moisture < 30.0):
            condition = "severe_water_stress"
            risk_level = RiskLevel.ACTION_REQUIRED if soil_moisture < 20.0 else RiskLevel.ATTENTION
            confidence = ConfidenceTier.HIGH if highest_visual_conf >= 0.70 else ConfidenceTier.MEDIUM
            action = "Deliver targeted drip irrigation at 15 Liters per square meter."
            secondary_action = "Apply organic mulch around plant bases to conserve remaining moisture."
            reason = (
                f"Visual wilting (confidence {highest_visual_conf:.0%}) corroborated by critical soil moisture deficit "
                f"at {soil_moisture:.1f}% and canopy heat at {temp:.1f}°C."
            )
            voice_en = f"Action required in Zone {zone_id}. Severe water stress detected. Irrigate zone immediately via drip."
            voice_ta = f"மண்டலம் {zone_id} இல் நடவடிக்கை தேவை. தீவிர நீர் பற்றாக்குறை. சொட்டுநீர் பாசனத்தை உடனே இயக்கவும்."
            voice_hi = f"जोन {zone_id} में तत्काल कार्रवाई आवश्यक है। गंभीर जल संकट। ड्रिप द्वारा तुरंत सिंचाई करें।"

        # Case C: Sensor-driven Water Stress (no visual symptom required)
        elif soil_moisture < 20.0:
            condition = "critical_drought_stress"
            risk_level = RiskLevel.ACTION_REQUIRED
            confidence = ConfidenceTier.HIGH
            action = "Initiate emergency drip cycle in zone immediately."
            secondary_action = "Inspect irrigation drippers for clogging or pressure loss."
            reason = f"Soil moisture at {soil_moisture:.1f}% is critically below permanent wilting threshold (20%)."
            voice_en = f"Action required in Zone {zone_id}. Soil moisture critically low at {soil_moisture:.0f} percent. Irrigate immediately."
            voice_ta = f"மண்டலம் {zone_id} இல் நடவடிக்கை தேவை. மண் ஈரப்பதம் {soil_moisture:.0f} சதவீதமாக குறைந்துள்ளது. உடனே பாசனம் செய்யவும்."
            voice_hi = f"जोन {zone_id} में तत्काल कार्रवाई आवश्यक है। मिट्टी की नमी {soil_moisture:.0f} प्रतिशत तक गिर गई है। तुरंत पानी दें।"

        elif soil_moisture < 30.0:
            condition = "moisture_deficit"
            risk_level = RiskLevel.ATTENTION
            confidence = ConfidenceTier.HIGH
            action = "Schedule irrigation cycle within 3 hours."
            secondary_action = "Monitor transpiration rates throughout midday peak."
            reason = f"Soil moisture has depleted to {soil_moisture:.1f}%, indicating moderate drought stress."
            voice_en = f"Attention in Zone {zone_id}. Soil moisture has declined to {soil_moisture:.0f} percent. Schedule irrigation."
            voice_ta = f"மண்டலம் {zone_id} இல் கவனம் தேவை. மண் ஈரப்பதம் குறைந்து வருகிறது. பாசனத்தை திட்டமிடவும்."
            voice_hi = f"जोन {zone_id} में ध्यान दें। मिट्टी की नमी कम हो रही है। अगले 3 घंटे में सिंचाई निर्धारित करें।"

        # Case D: Waterlogging & Flood
        elif soil_moisture > 85.0 or rainfall > 45.0:
            condition = "root_zone_waterlogging"
            risk_level = RiskLevel.ACTION_REQUIRED
            confidence = ConfidenceTier.HIGH
            action = "Open drainage furrows and cease any scheduled irrigation."
            secondary_action = "Check for standing surface water to prevent root asphyxiation."
            reason = f"Soil saturation at {soil_moisture:.1f}% with {rainfall:.1f}mm rainfall threatens root respiration."
            voice_en = f"Action required in Zone {zone_id}. Excessive waterlogging detected. Clear drainage channels immediately."
            voice_ta = f"மண்டலம் {zone_id} இல் நடவடிக்கை தேவை. அதிகப்படியான நீர் தேக்கம். வடிகால் வாய்க்கால்களை உடனே திறக்கவும்."
            voice_hi = f"जोन {zone_id} में तत्काल कार्रवाई आवश्यक है। खेत में जलभराव। जल निकासी तुरंत सुनिश्चित करें।"

        # Case E: Extreme Heat Stress
        elif temp >= 38.0:
            condition = "extreme_heat_stress"
            risk_level = RiskLevel.ACTION_REQUIRED if temp >= 40.0 else RiskLevel.ATTENTION
            confidence = ConfidenceTier.HIGH
            action = "Deploy canopy shade netting or micro-sprinkler misting."
            secondary_action = "Avoid chemical fertilizer application during high thermal load."
            reason = f"Canopy temperature reached {temp:.1f}°C, triggering thermal shock and stomatal closure."
            voice_en = f"Action required in Zone {zone_id}. Canopy temperature elevated at {temp:.0f} degrees. Deploy heat protection."
            voice_ta = f"மண்டலம் {zone_id} இல் நடவடிக்கை தேவை. பயிர் வெப்பநிலை {temp:.0f} டிகிரி வரை உயர்ந்துள்ளது. நிழல் வலைகளை பயன்படுத்தவும்."
            voice_hi = f"जोन {zone_id} में तत्काल कार्रवाई आवश्यक है। तापमान {temp:.0f} डिग्री पार कर गया है। छाया या फव्वारा चलाएं।"

        # Case F: Pest Infestation
        elif pest_level >= 45.0:
            condition = "pest_infestation"
            risk_level = RiskLevel.ACTION_REQUIRED if pest_level >= 70.0 else RiskLevel.ATTENTION
            confidence = ConfidenceTier.HIGH
            action = "Deploy targeted bio-pesticide spray and inspect leaf undersides."
            secondary_action = "Install sticky pheromone traps to capture active population."
            reason = f"Automated trap index is {pest_level:.0f}%, indicating rapid pest reproduction."
            voice_en = f"Attention in Zone {zone_id}. Elevated pest activity index of {pest_level:.0f} percent. Deploy bio-pesticide."
            voice_ta = f"மண்டலம் {zone_id} இல் கவனம் தேவை. பூச்சி தாக்குதல் குறியீடு {pest_level:.0f} சதவீதமாக அதிகரித்துள்ளது. இயற்கை பூச்சிக்கொல்லி தெளிக்கவும்."
            voice_hi = f"जोन {zone_id} में ध्यान दें। कीट प्रकोप सूचकांक {pest_level:.0f} प्रतिशत तक पहुंच गया है। जैविक कीटनाशक का प्रयोग करें।"

        # Case G: Foliar Disease Symptoms with Moderate Weather
        elif has_visual_disease:
            is_blotch = any("blotch" in (v.details or "").lower() or "blotch" in v.type.lower() for v in visual_evidence)
            condition = "leaf_blotch" if is_blotch else ("rhizome_rot" if primary_symptom in ["wilting", "rhizome_discoloration"] else "early_blight")
            risk_level = RiskLevel.ATTENTION
            confidence = ConfidenceTier.MEDIUM
            action = "Apply targeted bio-fungicide or Mancozeb spray to prevent further spread."
            secondary_action = "Monitor microclimate humidity and inspect adjacent plants."
            reason = f"Visual detection of {primary_symptom} (confidence {highest_visual_conf:.0%}) detected on canopy foliage."
            voice_en = f"Attention in Zone {zone_id}. Visual symptoms of {condition.replace('_', ' ')} detected on canopy. Inspect zone."
            voice_ta = f"மண்டலம் {zone_id} இல் கவனம் தேவை. பயிரில் {condition} அறிகுறிகள் தென்படுகின்றன."
            voice_hi = f"जोन {zone_id} में ध्यान दें। फसल पर {condition} के लक्षण मिले हैं।"

        # Case H: Optimal / Healthy
        else:

            condition = "healthy_crop"
            risk_level = RiskLevel.HEALTHY
            confidence = ConfidenceTier.HIGH
            action = "Maintain regular sensory monitoring and scheduled agronomic practices."
            secondary_action = "Continue standard irrigation intervals."
            reason = "All volumetric moisture, canopy temperature, and physiological indicators remain in optimal bounds."
            voice_en = f"Zone {zone_id} is healthy. All moisture, temperature, and crop indicators are optimal."
            voice_ta = f"மண்டலம் {zone_id} ஆரோக்கியமாக உள்ளது. மண் ஈரப்பதம் மற்றும் வெப்பநிலை சரியான அளவில் உள்ளன."
            voice_hi = f"जोन {zone_id} पूरी तरह स्वस्थ है। नमी, तापमान और फसल के सभी मानक सामान्य हैं।"

        recommendation = Advisory(
            action=action,
            secondary_action=secondary_action,
            urgency=risk_level,
            reason=reason,
            voice_text={
                "en": voice_en,
                "ta": voice_ta,
                "hi": voice_hi,
            },
        )

        return DiagnosisResult(
            zone_id=zone_id,
            timestamp=now,
            diagnosis=DiagnosisCore(
                condition=condition,
                confidence=confidence,
                risk_level=risk_level,
            ),
            visual_evidence=visual_evidence,
            sensor_evidence=sensor_readings,
            environmental_match=environmental_match,
            recommendation=recommendation,
        )


fusion_engine = MultimodalFusionEngine()
