from typing import Dict, Any
from simulator.scenarios.base import BaseScenario


class HeatScenario(BaseScenario):
    def get_name(self) -> str:
        return "Heat Wave"

    def get_description(self) -> str:
        return "Extreme ambient temperature surge causing canopy thermal stress and high transpiration loss."

    def next_tick(self) -> Dict[str, Any]:
        self.tick_count += 1
        t = self.tick_count

        if t <= 4:
            temperature = 29.0 + (t * 0.6)
            humidity = 55.0 - (t * 1.0)
            moisture = 46.0 - (t * 0.5)
        elif t <= 10:
            progress = (t - 4) / 6.0
            temperature = 32.2 + (progress * 2.5)
            humidity = 50.0 - (progress * 8.0)
            moisture = 44.0 - (progress * 3.0)
        elif t <= 18:
            progress = (t - 10) / 8.0
            temperature = 35.2 + (progress * 4.0)
            humidity = 41.0 - (progress * 7.0)
            moisture = 40.5 - (progress * 4.5)
        else:
            progress = min(1.0, (t - 18) / 10.0)
            temperature = 40.2 + (progress * 3.2)
            humidity = 33.0 - (progress * 6.0)
            moisture = 35.5 - (progress * 4.0)

        return {
            "field_id": self.target_field,
            "soil_moisture": round(max(25.0, moisture), 1),
            "temperature": round(min(45.0, temperature), 1),
            "humidity": round(max(20.0, humidity), 1),
            "rainfall_mm": 0.0,
            "pest_level": 14.0,
            "disease_index": 12.0,
        }
