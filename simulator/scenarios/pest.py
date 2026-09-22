from typing import Dict, Any
from simulator.scenarios.base import BaseScenario


class PestScenario(BaseScenario):
    def get_name(self) -> str:
        return "Pest Outbreak"

    def get_description(self) -> str:
        return "Rapid buildup of insect pest activity detected by acoustic and vision edge sensors, causing crop damage."

    def next_tick(self) -> Dict[str, Any]:
        self.tick_count += 1
        t = self.tick_count

        if t <= 4:
            pest = 10.0 + (t * 2.5)
        elif t <= 10:
            progress = (t - 4) / 6.0
            pest = 26.0 + (progress * 17.0)
        elif t <= 18:
            progress = (t - 10) / 8.0
            pest = 46.0 + (progress * 22.0)
        else:
            progress = min(1.0, (t - 18) / 10.0)
            pest = 72.0 + (progress * 18.0)

        return {
            "field_id": self.target_field,
            "soil_moisture": 45.0,
            "temperature": 29.5,
            "humidity": 62.0,
            "rainfall_mm": 0.0,
            "pest_level": round(min(98.0, pest), 1),
            "disease_index": 18.0,
        }
