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
  // Offline fallback
  const cached = await offlineStorage.getZones();
  if (cached && cached.length > 0) return cached;
  throw new Error("Unable to load zones: backend unreachable and no offline cache available.");
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
    console.warn("[API] fetchFarmSummary offline:", e);
  }
  // Construct fallback from cached zones
  const zones = await offlineStorage.getZones();
  return {
    farm: {
      id: "farm-demo",
      name: "Demo Farm",
      location: "Coimbatore, Tamil Nadu",
      areaAcres: 12.4,
      primaryCrop: "Tomato",
      fieldCount: zones.length || 25,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    fields: [],
    environmental: {
      heatStress: { type: "heat", status: "normal", label: "Normal canopy temperature" },
      droughtRisk: { type: "drought", status: "normal", label: "Optimal soil moisture" },
      floodRisk: { type: "flood", status: "normal", label: "Low flood risk" },
      diseaseWeather: { type: "disease", status: "normal", label: "Low pathogen weather risk" },
      updatedAt: new Date().toISOString(),
    },
    edgeSystem: {
      status: "connected",
      aiInference: "active",
      camera: "connected",
      soilSensors: "connected",
      weatherSensors: "connected",
      localProcessing: true,
      network: "connected",
      lastInferenceAt: new Date().toISOString(),
      version: "2.0.0-rhizosense-edge",
      updatedAt: new Date().toISOString(),
    },
    activeNotifications: 1,
    lastUpdated: new Date().toISOString(),
  };
}

export async function fetchFields(): Promise<{ fields: FieldSummary[]; updatedAt: string }> {
  const res = await fetch(`${API_BASE}/fields`);
  if (!res.ok) throw new Error(`Failed to fetch fields: ${res.statusText}`);
  return res.json();
}

export async function fetchFieldDetail(fieldId: string): Promise<Field> {
  const res = await fetch(`${API_BASE}/fields/${encodeURIComponent(fieldId)}`);
  if (!res.ok) throw new Error(`Failed to fetch field detail: ${res.statusText}`);
  return res.json();
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch analytics: ${res.statusText}`);
  return res.json();
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
