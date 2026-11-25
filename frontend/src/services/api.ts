import {
  FarmSummary,
  Field,
  FieldSummary,
  Notification,
  AnalyticsResponse,
  AnalyticsPeriod,
  MetricType,
  VisionDetectionResult,
} from "../types";
import {
  Zone,
  DiagnosisResult,
  SensorReading,
  VisualEvidence,
} from "../types/canonical";
import { offlineStorage } from "./storage";
import { syncManager } from "./syncManager";

const getApiBase = (): string => {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!envUrl) {
    return "http://127.0.0.1:8000/api";
  }
  const clean = envUrl.replace(/\/+$/, "");
  return clean.endsWith("/api") ? clean : `${clean}/api`;
};

const API_BASE = getApiBase();

export function getApiConfigStatus(): { apiBase: string; isMissingProdEnv: boolean } {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  const isBrowserProd =
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname);
  return {
    apiBase: API_BASE,
    isMissingProdEnv: isBrowserProd && !envUrl,
  };
}

function buildFallbackZones(): Zone[] {
  const rows = ["A", "B", "C", "D", "E"];
  const now = new Date().toISOString();
  const zones: Zone[] = [];
  rows.forEach((letter, rIdx) => {
    for (let c = 1; c <= 5; c++) {
      const zoneId = `${letter}${c}`;
      zones.push({
        zone_id: zoneId,
        row: rIdx + 1,
        column: c,
        grid_size_m: 5,
        crop: "Turmeric",
        current_risk: zoneId === "B3" ? "ATTENTION" : "HEALTHY",
        last_updated: now,
      });
    }
  });
  return zones;
}

function buildFallbackFields(): FieldSummary[] {
  const now = new Date().toISOString();
  return [
    { id: "field-a", farmId: "farm-demo", name: "Field A", crop: "Turmeric", areaAcres: 2.1, healthPercent: 92, soilMoisturePercent: 54, temperatureC: 28.5, status: "normal", lastUpdated: now },
    { id: "field-b", farmId: "farm-demo", name: "Field B", crop: "Turmeric", areaAcres: 1.8, healthPercent: 90, soilMoisturePercent: 48, temperatureC: 29.2, status: "normal", lastUpdated: now },
    { id: "field-c", farmId: "farm-demo", name: "Field C (Zone B3)", crop: "Turmeric", areaAcres: 2.4, healthPercent: 74, soilMoisturePercent: 46, temperatureC: 30.1, status: "warning", issue: "Favorable Pathogen Weather / Leaf Blotch", lastUpdated: now },
    { id: "field-d", farmId: "farm-demo", name: "Field D", crop: "Turmeric", areaAcres: 2.0, healthPercent: 86, soilMoisturePercent: 38, temperatureC: 31.8, status: "advisory", issue: "Moderate moisture deficit", lastUpdated: now },
    { id: "field-e", farmId: "farm-demo", name: "Field E", crop: "Turmeric", areaAcres: 2.3, healthPercent: 93, soilMoisturePercent: 52, temperatureC: 28.9, status: "normal", lastUpdated: now },
    { id: "field-f", farmId: "farm-demo", name: "Field F", crop: "Turmeric", areaAcres: 1.8, healthPercent: 91, soilMoisturePercent: 44, temperatureC: 30.4, status: "normal", lastUpdated: now },
  ];
}

// ==========================================
// V2 Canonical Zone & Diagnosis Endpoints
// ==========================================

export async function fetchZones(): Promise<Zone[]> {
  try {
    const res = await fetch(`${API_BASE}/zones`);
    if (res.ok) {
      const data: Zone[] = await res.json();
      offlineStorage.saveZones(data).catch(() => {});
      return data;
    }
  } catch (e) {
    console.warn("[API] fetchZones failed, trying offline storage:", e);
  }
  const cached = await offlineStorage.getZones();
  if (cached && cached.length > 0) return cached;
  return buildFallbackZones();
}

export async function fetchZoneDetail(zoneId: string): Promise<Zone> {
  try {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}`);
    if (res.ok) return res.json();
  } catch (e) {
    console.warn("[API] fetchZoneDetail failed, checking local cache:", e);
  }
  const zones = await offlineStorage.getZones();
  const found = zones.find((z) => z.zone_id.toUpperCase() === zoneId.toUpperCase());
  if (found) return found;
  throw new Error(`Zone ${zoneId} not found in cache.`);
}

export async function fetchZoneDiagnosis(zoneId: string): Promise<DiagnosisResult> {
  try {
    const res = await fetch(`${API_BASE}/diagnosis/${encodeURIComponent(zoneId)}`);
    if (res.ok) {
      const data: DiagnosisResult = await res.json();
      offlineStorage.saveDiagnosis(data).catch(() => {});
      return data;
    }
  } catch (e) {
    console.warn("[API] fetchZoneDiagnosis failed, checking local cache:", e);
  }
  const cached = await offlineStorage.getDiagnosis(zoneId);
  if (cached) return cached;
  throw new Error(`Diagnosis for zone ${zoneId} not found offline.`);
}

export async function runVisionInference(params: {
  zone_id: string;
  video_source?: string;
  image_base64?: string;
  condition_override?: string;
  use_roboflow?: boolean;
  sample_fps?: number;
}): Promise<{
  zone_id: string;
  visual_evidence: VisualEvidence[];
  diagnosis: DiagnosisResult;
  alert_created: boolean;
  provider?: string;
  provider_note?: string;
  frames_processed?: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/vision/infer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.diagnosis) {
        offlineStorage.saveDiagnosis(data.diagnosis).catch(() => {});
      }
      return data;
    }
  } catch (e) {
    console.warn("[API] runVisionInference offline fallback:", e);
  }

  // Offline deterministic fallback
  const cachedDiag = await offlineStorage.getDiagnosis(params.zone_id);
  return {
    zone_id: params.zone_id,
    visual_evidence: [
      {
        type: params.condition_override || (params.zone_id === "B3" ? "wilting" : "healthy_canopy"),
        detected: true,
        confidence: 0.88,
        source: "offline_demo_adapter",
        details: "Evaluated in local offline demonstration mode.",
      },
    ],
    diagnosis: cachedDiag || {
      zone_id: params.zone_id,
      timestamp: new Date().toISOString(),
      diagnosis: {
        condition: params.zone_id === "B3" ? "rhizome_rot" : "healthy_crop",
        confidence: "HIGH",
        risk_level: params.zone_id === "B3" ? "ACTION_REQUIRED" : "HEALTHY",
      },
      visual_evidence: [],
      sensor_evidence: [],
      environmental_match: { matched: true, reason: "Local offline cached risk window." },
      recommendation: {
        action: params.zone_id === "B3" ? "Halt all irrigation cycles immediately." : "Maintain monitoring.",
        urgency: params.zone_id === "B3" ? "ACTION_REQUIRED" : "HEALTHY",
        voice_text: {
          en: `Action required in Zone ${params.zone_id}. Halt irrigation immediately.`,
          ta: `மண்டலம் ${params.zone_id} இல் நடவடிக்கை தேவை. பாசனத்தை உடனே நிறுத்தவும்.`,
          hi: `जोन ${params.zone_id} में तुरंत कार्रवाई करें। सिंचाई रोकें।`,
        },
      },
    },
    alert_created: params.zone_id === "B3",
    provider: "fallback/demo",
    provider_note: "Executed in local offline demonstration mode",
    frames_processed: 1,
  };
}

export async function fetchVisionConfig(): Promise<{
  provider: string;
  video_asset_path: string;
  video_asset_exists: boolean;
  hardware_target: string;
  roboflow_configured: boolean;
  roboflow_model_id: string;
  roboflow_frame_fps: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/vision/config`);
    if (res.ok) return res.json();
  } catch (e) {
    console.warn("[API] fetchVisionConfig failed, using defaults:", e);
  }
  return {
    provider: "demo",
    video_asset_path: "frontend/public/vision/plant-feed.mp4",
    video_asset_exists: false,
    hardware_target: "Edge NPU / Host Simulator",
    roboflow_configured: false,
    roboflow_model_id: "turmeric-final-tmips/1",
    roboflow_frame_fps: 2.0,
  };
}


export async function ingestSensorReadings(readings: SensorReading[]): Promise<any> {
  const res = await fetch(`${API_BASE}/sensors/readings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readings),
  });
  if (!res.ok) throw new Error(`Failed to ingest sensor readings: ${res.statusText}`);
  return res.json();
}

export async function acknowledgeFarmerAction(
  zoneId: string,
  actionTaken: string,
  recommendationId?: string,
  notes?: string
): Promise<any> {
  const payload = {
    zone_id: zoneId,
    recommendation_id: recommendationId,
    action_taken: actionTaken,
    notes,
  };

  try {
    const res = await fetch(`${API_BASE}/actions/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return res.json();
  } catch (e) {
    console.warn("[API] acknowledgeFarmerAction offline, queueing via syncManager:", e);
  }

  // Queue locally if offline or server unreachable
  return syncManager.enqueueAction("farmer_ack", payload);
}

// ==========================================
// Legacy / Admin V1 Endpoints
// ==========================================

export async function fetchFarmSummary(): Promise<FarmSummary> {
  try {
    const res = await fetch(`${API_BASE}/farm`);
    if (res.ok) return res.json();
  } catch (e) {
    console.warn("[API] fetchFarmSummary offline fallback:", e);
  }
  const zones = await offlineStorage.getZones();
  const fallbackFields = buildFallbackFields();
  return {
    farm: {
      id: "farm-demo",
      name: "Demo Farm (Offline Resilience)",
      location: "Coimbatore, Tamil Nadu",
      areaAcres: 12.4,
      primaryCrop: "Turmeric",
      fieldCount: zones.length || 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    fields: fallbackFields,
    environmental: {
      heatStress: { type: "heat", status: "normal", label: "Normal canopy temperature" },
      droughtRisk: { type: "drought", status: "normal", label: "Optimal soil moisture" },
      floodRisk: { type: "flood", status: "normal", label: "Low flood risk" },
      diseaseWeather: { type: "disease", status: "warning", label: "Pathogen-conducive window in Field C" },
      updatedAt: new Date().toISOString(),
    },
    edgeSystem: {
      status: "disconnected",
      aiInference: "active",
      camera: "connected",
      soilSensors: "connected",
      weatherSensors: "connected",
      localProcessing: true,
      network: "disconnected",
      lastInferenceAt: new Date().toISOString(),
      version: "2.0.0-rhizosense-edge",
      updatedAt: new Date().toISOString(),
    },
    activeNotifications: 1,
    lastUpdated: new Date().toISOString(),
  };
}

export async function fetchFields(): Promise<{ fields: FieldSummary[]; updatedAt: string }> {
  try {
    const res = await fetch(`${API_BASE}/fields`);
    if (res.ok) return res.json();
  } catch (e) {
    console.warn("[API] fetchFields offline fallback:", e);
  }
  return { fields: buildFallbackFields(), updatedAt: new Date().toISOString() };
}

export async function fetchFieldDetail(fieldId: string): Promise<Field> {
  try {
    const res = await fetch(`${API_BASE}/fields/${encodeURIComponent(fieldId)}`);
    if (res.ok) return res.json();
  } catch (e) {
    console.warn("[API] fetchFieldDetail offline fallback:", e);
  }
  const summary = buildFallbackFields().find((f) => f.id === fieldId) || buildFallbackFields()[2];
  const now = new Date().toISOString();
  return {
    id: summary.id,
    farmId: summary.farmId,
    name: summary.name,
    crop: summary.crop,
    areaAcres: summary.areaAcres,
    status: summary.status,
    cropHealth: {
      score: summary.healthPercent,
      condition: summary.status === "normal" ? "healthy" : "stressed",
      status: summary.status,
    },
    environmental: {
      temperatureC: summary.temperatureC,
      humidityPercent: 64,
      heatStress: { type: "heat", status: "normal", label: "Optimal temperature" },
      droughtRisk: { type: "drought", status: summary.status, label: "Monitored moisture" },
      floodRisk: { type: "flood", status: "normal", label: "Low flood risk" },
      diseaseWeather: { type: "disease", status: summary.status === "warning" ? "warning" : "normal", label: "Monitored pathogen weather" },
      rainfallMm: 0,
      updatedAt: now,
    },
    water: {
      soilMoisturePercent: summary.soilMoisturePercent,
      waterStressPercent: 25,
      irrigationNeeded: false,
      irrigationStatus: "not_required",
      waterConsumptionLiters: 110,
      updatedAt: now,
    },
    risk: {
      type: summary.status === "normal" ? "none" : "disease",
      status: summary.status,
      title: summary.issue || "Optimal Growing Conditions",
      description: "Operating via local edge telemetry cache while awaiting backend reconnect.",
      detectedAt: now,
    },
    aiAssessment: {
      title: summary.issue || "Optimal Canopy",
      summary: "Edge AI local assessment active.",
      confidencePercent: 91,
      indicators: [
        { id: "sm", label: "Soil Moisture", value: `${summary.soilMoisturePercent}%`, contribution: "high" },
        { id: "temp", label: "Temperature", value: `${summary.temperatureC}°C`, contribution: "medium" },
      ],
      model: { name: "RhizoSense Edge V2", version: "2.0.0", inferenceType: "multimodal" },
      generatedAt: now,
    },
    recommendation: {
      id: `rec-${summary.id}-live`,
      title: `Monitor ${summary.name}`,
      action: summary.status === "normal" ? "Continue standard monitoring." : "Inspect canopy foliage and halt excess irrigation.",
      reason: "Multimodal edge evaluation.",
      priority: summary.status,
      generatedAt: now,
      reviewed: false,
    },
    lastUpdated: now,
  };
}

export async function fetchNotifications(params?: {
  status?: string;
  severity?: string;
  fieldId?: string;
}): Promise<{ notifications: Notification[]; total: number; updatedAt: string }> {
  try {
    const url = new URL(`${API_BASE}/notifications`);
    if (params?.status && params.status !== "all") url.searchParams.set("status", params.status);
    if (params?.severity && params.severity !== "all") url.searchParams.set("severity", params.severity);
    if (params?.fieldId) url.searchParams.set("fieldId", params.fieldId);

    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      offlineStorage.saveAlerts(data.notifications || []).catch(() => {});
      return data;
    }
  } catch (e) {
    console.warn("[API] fetchNotifications offline:", e);
  }
  const cached = await offlineStorage.getAlerts();
  return {
    notifications: cached,
    total: cached.length,
    updatedAt: new Date().toISOString(),
  };
}

export async function resolveNotification(notificationId: string): Promise<Notification> {
  try {
    const res = await fetch(`${API_BASE}/notifications/${encodeURIComponent(notificationId)}/resolve`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      return data.notification;
    }
  } catch (e) {
    console.warn("[API] resolveNotification offline, queueing:", e);
  }
  await syncManager.enqueueAction("alert_resolved", { notification_id: notificationId });
  return {
    id: notificationId,
    farmId: "farm-demo",
    fieldId: "B3",
    severity: "warning",
    type: "disease",
    title: "Alert Resolved Locally",
    message: "Action queued for sync upon reconnect.",
    status: "resolved",
    recommendation: "Sync queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function reviewRecommendation(recommendationId: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/recommendations/${encodeURIComponent(recommendationId)}/review`, {
      method: "POST",
    });
    if (res.ok) return;
  } catch (e) {
    console.warn("[API] reviewRecommendation offline, queueing:", e);
  }
  await syncManager.enqueueAction("recommendation_reviewed", { recommendation_id: recommendationId });
}

export async function fetchAnalytics(
  fieldId: string,
  metrics: MetricType[],
  period: AnalyticsPeriod
): Promise<AnalyticsResponse> {
  const metricStr = metrics.join(",");
  const url = `${API_BASE}/analytics?fieldId=${encodeURIComponent(fieldId)}&metrics=${encodeURIComponent(metricStr)}&period=${period}`;
  try {
    const res = await fetch(url);
    if (res.ok) return res.json();
  } catch (e) {
    console.warn("[API] fetchAnalytics offline fallback:", e);
  }
  const now = Date.now();
  const series = metrics.slice(0, 3).map((m) => ({
    fieldId,
    metric: m,
    unit: m === "temperature" ? "°C" : "%",
    period,
    generatedAt: new Date().toISOString(),
    points: Array.from({ length: 12 }, (_, i) => ({
      timestamp: new Date(now - (11 - i) * 3600000).toISOString(),
      value: m === "temperature" ? 29 + (i % 3) : m === "soil_moisture" ? 48 - i * 0.5 : 85 - (i % 4),
    })),
  }));
  return {
    query: { farmId: "farm-demo", fieldId, metrics, period },
    series,
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchVisionDetection(fieldId: string = "field-c"): Promise<VisionDetectionResult> {
  const res = await fetch(`${API_BASE}/vision/detection?fieldId=${encodeURIComponent(fieldId)}`);
  if (!res.ok) throw new Error(`Failed to fetch vision detection: ${res.statusText}`);
  return res.json();
}

export async function submitVisionDetection(
  payload: VisionDetectionResult,
  fieldId: string = "field-c"
): Promise<VisionDetectionResult> {
  const res = await fetch(`${API_BASE}/vision/detection?fieldId=${encodeURIComponent(fieldId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to submit vision detection: ${res.statusText}`);
  return res.json();
}

export async function simulateVisionDetection(
  fieldId: string = "field-c",
  detected?: boolean
): Promise<VisionDetectionResult> {
  const query = detected !== undefined ? `&detected=${detected}` : "";
  const res = await fetch(`${API_BASE}/vision/simulate?fieldId=${encodeURIComponent(fieldId)}${query}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to simulate vision detection: ${res.statusText}`);
  return res.json();
}
