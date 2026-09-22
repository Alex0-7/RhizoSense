from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseScenario(ABC):
    def __init__(self, target_field: str = "field-c"):
        self.target_field = target_field
        self.tick_count = 0

    @abstractmethod
    def get_name(self) -> str:
        pass

    @abstractmethod
    def get_description(self) -> str:
        pass

    @abstractmethod
    def next_tick(self) -> Dict[str, Any]:
        """
        Returns a dict containing telemetry values for the target field:
        {
            "field_id": str,
            "soil_moisture": float,
            "temperature": float,
            "humidity": float,
            "rainfall_mm": float,
            "pest_level": float,
            "disease_index": float
        }
        """
        pass
