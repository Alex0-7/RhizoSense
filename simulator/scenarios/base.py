from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, List

from backend.app.schemas.canonical import SensorReading


class BaseScenario(ABC):
    def __init__(self, target_field: str = "B3"):
        # Normalize legacy field-c to canonical demo zone B3
        if target_field.lower() in ["field-c", "c"]:
            self.target_field = "B3"
        else:
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
        Returns a dict containing telemetry values for the target field/zone:
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

    def next_canonical_readings(self) -> List[SensorReading]:
        """
        Converts next tick telemetry into canonical SensorReading records
        adhering to docs/05_SENSOR_INTERFACE.md.
        """
        data = self.next_tick()
        now = datetime.now(timezone.utc).isoformat()
        zone = str(data.get("field_id", self.target_field)).upper()

        readings = [
            SensorReading(
                zone_id=zone,
                metric="soil_moisture",
                value=float(data["soil_moisture"]),
                unit="%",
                timestamp=now,
                source="simulator",
            ),
            SensorReading(
                zone_id=zone,
                metric="soil_temperature",
                value=float(data["temperature"]),
                unit="°C",
                timestamp=now,
                source="simulator",
            ),
            SensorReading(
                zone_id=zone,
                metric="humidity",
                value=float(data["humidity"]),
                unit="%",
                timestamp=now,
                source="simulator",
            ),
            SensorReading(
                zone_id=zone,
                metric="rainfall_mm",
                value=float(data.get("rainfall_mm", 0.0)),
                unit="mm",
                timestamp=now,
                source="simulator",
            ),
            SensorReading(
                zone_id=zone,
                metric="pest_level",
                value=float(data.get("pest_level", 10.0)),
                unit="%",
                timestamp=now,
                source="simulator",
            ),
        ]
        return readings
