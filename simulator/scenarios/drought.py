from typing import Dict, Any
from simulator.scenarios.base import BaseScenario


class DroughtScenario(BaseScenario):
    def get_name(self) -> str:
        return "Drought"

    def get_description(self) -> str:
        return "Progression from optimal soil moisture to critical water stress with elevated canopy temperature."

    def next_tick(self) -> Dict[str, Any]:
        self.tick_count += 1
        t = self.tick_count

        if t <= 4:
            # Stage 1: Normal (46% -> 41%)
            moisture = 46.0 - (t * 1.2)
            temperature = 29.5 + (t * 0.4)
            humidity = 58.0 - (t * 1.5)
        elif t <= 10:
            # Stage 2: Advisory (40% -> 31%)
            progress = (t - 4) / 6.0
            moisture = 40.0 - (progress * 9.5)
            temperature = 31.5 + (progress * 2.5)
            humidity = 52.0 - (progress * 8.0)
        elif t <= 18:
            # Stage 3: Warning (29% -> 21%)
            progress = (t - 10) / 8.0
            moisture = 29.5 - (progress * 9.0)
            temperature = 34.0 + (progress * 2.2)
            humidity = 44.0 - (progress * 7.0)
        else:
            # Stage 4: Critical (< 20% down to 14.5%)
            progress = min(1.0, (t - 18) / 10.0)
            moisture = 19.5 - (progress * 5.0)
            temperature = 36.5 + (progress * 2.0)
            humidity = 36.0 - (progress * 6.0)

        return {
            "field_id": self.target_field,
            "soil_moisture": round(max(12.0, moisture), 1),
            "temperature": round(min(45.0, temperature), 1),
            "humidity": round(max(20.0, humidity), 1),
            "rainfall_mm": 0.0,
            "pest_level": 11.0,
            "disease_index": 10.0,
        }
