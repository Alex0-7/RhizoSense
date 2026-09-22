from typing import Dict, Any
from simulator.scenarios.base import BaseScenario


class FloodScenario(BaseScenario):
    def get_name(self) -> str:
        return "Flood & Waterlogging"

    def get_description(self) -> str:
        return "Excessive precipitation resulting in soil supersaturation, standing water, and anaerobic root stress."

    def next_tick(self) -> Dict[str, Any]:
        self.tick_count += 1
        t = self.tick_count

        if t <= 4:
            rainfall = t * 3.5
            moisture = 50.0 + (t * 4.0)
            humidity = 65.0 + (t * 2.0)
        elif t <= 10:
            progress = (t - 4) / 6.0
            rainfall = 14.0 + (progress * 15.0)
            moisture = 67.0 + (progress * 7.5)
            humidity = 73.0 + (progress * 6.0)
        elif t <= 18:
            progress = (t - 10) / 8.0
            rainfall = 29.0 + (progress * 20.0)
            moisture = 75.5 + (progress * 9.0)
            humidity = 80.0 + (progress * 8.0)
        else:
            progress = min(1.0, (t - 18) / 10.0)
            rainfall = 50.0 + (progress * 25.0)
            moisture = 86.0 + (progress * 9.0)
            humidity = 89.0 + (progress * 6.0)

        return {
            "field_id": self.target_field,
            "soil_moisture": round(min(98.0, moisture), 1),
            "temperature": round(24.5 - (min(30, t) * 0.1), 1),
            "humidity": round(min(98.0, humidity), 1),
            "rainfall_mm": round(rainfall, 1),
            "pest_level": 8.0,
            "disease_index": round(min(90.0, 20.0 + (t * 2.0)), 1),
        }
