import math
from typing import Dict, Any
from simulator.scenarios.base import BaseScenario


class NormalScenario(BaseScenario):
    def get_name(self) -> str:
        return "Normal"

    def get_description(self) -> str:
        return "Stable optimal growing conditions across monitored fields with gentle natural diurnal variation."

    def next_tick(self) -> Dict[str, Any]:
        self.tick_count += 1
        t = self.tick_count

        # Gentle physiological oscillation
        moisture = 48.0 + 2.5 * math.sin(t * 0.1)
        temperature = 29.0 + 1.8 * math.cos(t * 0.08)
        humidity = 58.0 + 3.0 * math.sin(t * 0.09)
        pest = 8.0 + 2.0 * math.cos(t * 0.05)

        return {
            "field_id": self.target_field,
            "soil_moisture": round(moisture, 1),
            "temperature": round(temperature, 1),
            "humidity": round(humidity, 1),
            "rainfall_mm": 0.0,
            "pest_level": round(pest, 1),
            "disease_index": 12.0,
        }
