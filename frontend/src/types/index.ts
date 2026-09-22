export type Status = "normal" | "advisory" | "warning" | "critical";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

export type NotificationSeverity = "info" | "advisory" | "warning" | "critical";

export type NotificationState = "active" | "resolved";

export type NotificationType =
  | "crop_health"
  | "water_stress"
  | "irrigation"
  | "soil_moisture"
  | "temperature"
  | "humidity"
  | "pest"
  | "disease"
  | "drought"
  | "flood"
  | "heat_stress"
  | "system"
  | "general";

export type CropHealthCondition = "healthy" | "stressed" | "at_risk" | "severely_stressed";

export type RiskType =
  | "water_stress"
  | "drought"
  | "flood"
  | "heat"
  | "pest"
  | "disease"
  | "nutrient"
  | "irrigation"
  | "none";

export type SensorStatus = "connected" | "disconnected" | "degraded" | "unknown";

export type InferenceStatus = "active" | "idle" | "error" | "unavailable";

export type IrrigationStatus =
  | "not_required"
  | "recommended"
  | "urgent"
  | "in_progress"
  | "completed";

export type MetricType =
  | "soil_moisture"
  | "temperature"
  | "humidity"
  | "crop_health"
  | "pest_activity"
  | "disease_risk"
  | "water_consumption";

export type AnalyticsPeriod = "24h" | "7d" | "30d";

export interface Farm {
  id: string;
  name: string;
  location?: string;
  areaAcres: number;
  primaryCrop: string;
  fieldCount: number;
  createdAt?: string;
  updatedAt: string;
}

export interface CropHealth {
  score: number;
  condition: CropHealthCondition;
  status: Status;
}

export interface RiskState {
  type: RiskType;
  status: Status;
  level?: number;
  label: string;
  description?: string;
}

export interface FieldEnvironment {
  temperatureC: number;
  humidityPercent: number;
  heatStress: RiskState;
  droughtRisk: RiskState;
  floodRisk: RiskState;
  diseaseWeather: RiskState;
  rainfallMm?: number;
  updatedAt: string;
}

export interface FieldWaterState {
  soilMoisturePercent: number;
  waterStressPercent?: number;
  irrigationNeeded: boolean;
  irrigationStatus?: IrrigationStatus;
  waterConsumptionLiters?: number;
  updatedAt: string;
}

export interface RiskAssessment {
  type: RiskType;
  status: Status;
  title: string;
  description: string;
  detectedAt?: string;
}

export interface AssessmentIndicator {
  id: string;
  label: string;
  value?: string;
  contribution?: "low" | "medium" | "high";
}

export interface ModelInfo {
  name: string;
  version: string;
  inferenceType?: string;
}

export interface AIAssessment {
  title: string;
  summary: string;
  confidencePercent: number;
  indicators: AssessmentIndicator[];
  model?: ModelInfo;
  generatedAt: string;
}

export interface Recommendation {
  id: string;
  title: string;
  action: string;
  reason: string;
  priority: Status;
  generatedAt: string;
  reviewed: boolean;
  reviewedAt?: string;
}

export interface EdgeSystem {
  status: ConnectionStatus;
  aiInference: InferenceStatus;
  camera: SensorStatus;
  soilSensors: SensorStatus;
  weatherSensors: SensorStatus;
  localProcessing: boolean;
  network: ConnectionStatus;
  lastInferenceAt?: string;
  version?: string;
  updatedAt: string;
}

export interface WaterStatusSummary {
  status: Status;
  level: string;
  label: string;
  consumptionLiters24h: number;
}

export interface EnvironmentalSummary {
  overallStatus?: Status;
  droughtRisk: RiskState;
  heatStress: RiskState;
  floodRisk: RiskState;
  diseaseWeather: RiskState;
  waterStatus?: WaterStatusSummary;
  activeAdvisoriesCount?: number;
  updatedAt: string;
}

export interface FieldSummary {
  id: string;
  farmId: string;
  name: string;
  crop: string;
  areaAcres: number;
  healthPercent: number;
  soilMoisturePercent: number;
  temperatureC: number;
  status: Status;
  issue?: string;
  lastUpdated: string;
}

export interface Field {
  id: string;
  farmId: string;
  name: string;
  crop: string;
  areaAcres: number;
  status: Status;
  cropHealth: CropHealth;
  environmental: FieldEnvironment;
  water: FieldWaterState;
  risk: RiskAssessment;
  aiAssessment?: AIAssessment;
  recommendation?: Recommendation;
  lastUpdated: string;
}

export interface FarmSummary {
  farm: Farm;
  fields: FieldSummary[];
  environmental: EnvironmentalSummary;
  edgeSystem: EdgeSystem;
  activeNotifications: number;
  lastUpdated: string;
}

export interface NotificationMetadata {
  metric?: string;
  value?: number;
  unit?: string;
  previousStatus?: Status;
  currentStatus?: Status;
  riskType?: RiskType;
}

export interface Notification {
  id: string;
  farmId: string;
  fieldId?: string;
  severity: NotificationSeverity;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationState;
  recommendation?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  metadata?: NotificationMetadata;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface MetricSeries {
  fieldId: string;
  metric: MetricType;
  unit: string;
  points: MetricPoint[];
  period: AnalyticsPeriod;
  generatedAt: string;
}

export interface AnalyticsQuery {
  farmId: string;
  fieldId?: string;
  metrics: MetricType[];
  period: AnalyticsPeriod;
}

export interface AnalyticsResponse {
  query: AnalyticsQuery;
  series: MetricSeries[];
  generatedAt: string;
}

export interface WebSocketEvent<T = any> {
  event: string;
  timestamp: string;
  payload: T;
}
