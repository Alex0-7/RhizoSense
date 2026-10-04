from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from backend.app.schemas.canonical import SensorReading
from simulator.scenarios.normal import NormalScenario
from simulator.scenarios.drought import DroughtScenario
from simulator.scenarios.pest import PestScenario
from simulator.scenarios.heat import HeatScenario
from simulator.scenarios.flood import FloodScenario

SCENARIO_INSTANCES: Dict[str, Any] = {
    "normal": NormalScenario(),
    "drought": DroughtScenario(),
    "pest": PestScenario(),
    "heat": HeatScenario(),
    "flood": FloodScenario(),
}


def read_sensors(
    zone_id: str = "B3",
    scenario_name: str = "drought",
    tick: Optional[int] = None,
) -> List[SensorReading]:
    """
    Simulated sensor source for RhizoSense edge demonstration.
    Generates canonical SensorReading records for the specified micro-zone
    using the configured agronomic scenario progression curves.
    Adheres to docs/05_SENSOR_INTERFACE.md.
    """
    now = datetime.now(timezone.utc).isoformat()
    norm_zone = zone_id.upper().strip()

    # Get scenario instance
    scenario = SCENARIO_INSTANCES.get(scenario_name.lower())
    if not scenario:
        scenario = SCENARIO_INSTANCES["drought"]

    scenario.target_field = norm_zone
    if tick is not None:
        scenario.tick_count = tick - 1

    telemetry = scenario.next_tick()

    readings = [
        SensorReading(
            zone_id=norm_zone,
            metric="soil_moisture",
            value=float(telemetry["soil_moisture"]),
            unit="%",
            timestamp=now,
            source="sensor_source:read_sensors",
        ),
        SensorReading(
            zone_id=norm_zone,
            metric="soil_temperature",
            value=float(telemetry["temperature"]),
            unit="°C",
            timestamp=now,
            source="sensor_source:read_sensors",
        ),
        SensorReading(
            zone_id=norm_zone,
            metric="humidity",
            value=float(telemetry["humidity"]),
            unit="%",
            timestamp=now,
            source="sensor_source:read_sensors",
        ),
        SensorReading(
            zone_id=norm_zone,
            metric="rainfall_mm",
            value=float(telemetry.get("rainfall_mm", 0.0)),
            unit="mm",
            timestamp=now,
            source="sensor_source:read_sensors",
        ),
        SensorReading(
            zone_id=norm_zone,
            metric="pest_level",
            value=float(telemetry.get("pest_level", 10.0)),
            unit="%",
            timestamp=now,
            source="sensor_source:read_sensors",
        ),
    ]

    return readings
