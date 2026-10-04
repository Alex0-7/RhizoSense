/**
 * RhizoSense V2 Canonical Data Contracts
 * Defined in docs/03_DATA_CONTRACT.md
 */

export type RiskLevel = "HEALTHY" | "MONITOR" | "ATTENTION" | "ACTION_REQUIRED";

export type ConfidenceTier = "LOW" | "MEDIUM" | "HIGH";

export interface Zone {
  zone_id: string;
  row: number;
  column: number;
  grid_size_m: number;
  crop?: string;
  current_risk?: RiskLevel;
  last_updated?: string;
}

export interface VisualEvidence {
  type: string;
  detected: boolean;
  confidence: number; // 0.0 - 1.0
  source: string;
  details?: string;
}

export interface SensorReading {
  zone_id: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  source: string;
}

export interface EnvironmentalMatch {
  matched: boolean;
  reason: string;
}

export interface Advisory {
  action: string;
  secondary_action?: string;
  urgency?: RiskLevel;
  reason?: string;
  voice_text?: {
    en?: string;
    ta?: string;
    hi?: string;
  };
}

export interface DiagnosisCore {
  condition: string;
  confidence: ConfidenceTier;
  risk_level: RiskLevel;
}

export interface DiagnosisResult {
  zone_id: string;
  timestamp: string;
  diagnosis: DiagnosisCore;
  visual_evidence: VisualEvidence[];
  sensor_evidence: SensorReading[];
  environmental_match: EnvironmentalMatch;
  recommendation: Advisory;
}

export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";

export interface SyncRecord {
  local_id: string;
  event_type: string;
  timestamp: string;
  payload: Record<string, any>;
  sync_status: SyncStatus;
  retry_count: number;
  error_message?: string;
}

// Bidirectional conversion utilities
export function statusToRiskLevel(status: string): RiskLevel {
  const clean = (status || "").toLowerCase().trim();
  if (clean === "critical") return "ACTION_REQUIRED";
  if (clean === "warning") return "ATTENTION";
  if (clean === "advisory") return "MONITOR";
  return "HEALTHY";
}

export function riskLevelToStatus(risk: RiskLevel): "normal" | "advisory" | "warning" | "critical" {
  if (risk === "ACTION_REQUIRED") return "critical";
  if (risk === "ATTENTION") return "warning";
  if (risk === "MONITOR") return "advisory";
  return "normal";
}

export function confidenceFloatToTier(conf: number): ConfidenceTier {
  if (conf >= 0.8) return "HIGH";
  if (conf >= 0.5) return "MEDIUM";
  return "LOW";
}

export function tierToConfidenceFloat(tier: ConfidenceTier): number {
  if (tier === "HIGH") return 0.91;
  if (tier === "MEDIUM") return 0.72;
  return 0.4;
}
