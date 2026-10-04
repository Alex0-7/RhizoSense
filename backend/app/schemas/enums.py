from enum import Enum


class Status(str, Enum):
    NORMAL = "normal"
    ADVISORY = "advisory"
    WARNING = "warning"
    CRITICAL = "critical"


class ConnectionStatus(str, Enum):
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"


class NotificationSeverity(str, Enum):
    INFO = "info"
    ADVISORY = "advisory"
    WARNING = "warning"
    CRITICAL = "critical"


class NotificationState(str, Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"


class NotificationType(str, Enum):
    CROP_HEALTH = "crop_health"
    WATER_STRESS = "water_stress"
    IRRIGATION = "irrigation"
    SOIL_MOISTURE = "soil_moisture"
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    PEST = "pest"
    DISEASE = "disease"
    DROUGHT = "drought"
    FLOOD = "flood"
    HEAT_STRESS = "heat_stress"
    SYSTEM = "system"
    GENERAL = "general"


class CropHealthCondition(str, Enum):
    HEALTHY = "healthy"
    STRESSED = "stressed"
    AT_RISK = "at_risk"
    SEVERELY_STRESSED = "severely_stressed"


class RiskType(str, Enum):
    WATER_STRESS = "water_stress"
    DROUGHT = "drought"
    FLOOD = "flood"
    HEAT = "heat"
    PEST = "pest"
    DISEASE = "disease"
    NUTRIENT = "nutrient"
    IRRIGATION = "irrigation"
    NONE = "none"


class SensorStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


class InferenceStatus(str, Enum):
    ACTIVE = "active"
    IDLE = "idle"
    ERROR = "error"
    UNAVAILABLE = "unavailable"


class IrrigationStatus(str, Enum):
    NOT_REQUIRED = "not_required"
    RECOMMENDED = "recommended"
    URGENT = "urgent"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ReadingQuality(str, Enum):
    GOOD = "good"
    DEGRADED = "degraded"
    INVALID = "invalid"
    ESTIMATED = "estimated"


class MetricType(str, Enum):
    SOIL_MOISTURE = "soil_moisture"
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    CROP_HEALTH = "crop_health"
    PEST_ACTIVITY = "pest_activity"
    DISEASE_RISK = "disease_risk"
    WATER_CONSUMPTION = "water_consumption"


class AnalyticsPeriod(str, Enum):
    PERIOD_24H = "24h"
    PERIOD_7D = "7d"
    PERIOD_30D = "30d"
