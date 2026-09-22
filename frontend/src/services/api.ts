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

const getApiBase = (): string => {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!envUrl) {
    return "http://127.0.0.1:8000/api";
  }
  const clean = envUrl.replace(/\/+$/, "");
  return clean.endsWith("/api") ? clean : `${clean}/api`;
};

const API_BASE = getApiBase();

export async function fetchFarmSummary(): Promise<FarmSummary> {
  const res = await fetch(`${API_BASE}/farm`);
  if (!res.ok) throw new Error(`Failed to fetch farm summary: ${res.statusText}`);
  return res.json();
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
  const url = new URL(`${API_BASE}/notifications`);
  if (params?.status && params.status !== "all") url.searchParams.set("status", params.status);
  if (params?.severity && params.severity !== "all") url.searchParams.set("severity", params.severity);
  if (params?.fieldId) url.searchParams.set("fieldId", params.fieldId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.statusText}`);
  return res.json();
}

export async function resolveNotification(notificationId: string): Promise<Notification> {
  const res = await fetch(`${API_BASE}/notifications/${encodeURIComponent(notificationId)}/resolve`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to resolve notification: ${res.statusText}`);
  const data = await res.json();
  return data.notification;
}

export async function reviewRecommendation(recommendationId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/recommendations/${encodeURIComponent(recommendationId)}/review`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to review recommendation: ${res.statusText}`);
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
