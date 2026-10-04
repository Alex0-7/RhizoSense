import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { FarmSummary, FieldSummary, Notification, ConnectionStatus, WebSocketEvent } from "../types";
import { Zone, DiagnosisResult } from "../types/canonical";
import {
  fetchFarmSummary,
  fetchZones,
  fetchZoneDiagnosis,
  resolveNotification,
  reviewRecommendation,
  acknowledgeFarmerAction,
} from "../services/api";
import { wsClient } from "../services/websocket";
import { syncManager, SyncStateInfo } from "../services/syncManager";
import { offlineStorage } from "../services/storage";

export interface ToastItem {
  id: string;
  notification: Notification;
  enteredAt: number;
}

interface FarmContextType {
  // Legacy / Admin V1
  farmSummary: FarmSummary | null;
  fields: FieldSummary[];
  connectionStatus: ConnectionStatus;
  notifications: Notification[];
  activeNotificationsCount: number;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  addNotification: (notif: Notification) => void;
  markRecommendationReviewed: (recId: string) => Promise<void>;
  resolveNotif: (notifId: string) => Promise<void>;
  refresh: () => Promise<void>;
  loading: boolean;
  error: string | null;

  // V2 Canonical SmartFarm
  zones: Zone[];
  activeZoneId: string;
  setActiveZoneId: (id: string) => void;
  activeZone: Zone | null;
  activeDiagnosis: DiagnosisResult | null;
  loadZoneDiagnosis: (zoneId: string) => Promise<DiagnosisResult | null>;
  acknowledgeAction: (zoneId: string, action: string, recommendationId?: string) => Promise<void>;

  // Offline & Synchronization
  network: "online" | "offline";
  syncState: "idle" | "syncing" | "synced" | "error";
  pendingSyncCount: number;
  lastSyncedAt: string | null;
  toggleSimulatedOffline: () => void;
  flushSyncQueue: () => Promise<void>;

  // Dual-mode interface (Farmer App vs FPO/Admin Dashboard)
  interfaceMode: "farmer" | "admin";
  setInterfaceMode: (mode: "farmer" | "admin") => void;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [farmSummary, setFarmSummary] = useState<FarmSummary | null>(null);
  const [fields, setFields] = useState<FieldSummary[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string>("B3");
  const [activeDiagnosis, setActiveDiagnosis] = useState<DiagnosisResult | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [interfaceMode, setInterfaceMode] = useState<"farmer" | "admin">("farmer");

  // Sync Manager state subscription
  const [syncInfo, setSyncInfo] = useState<SyncStateInfo>(syncManager.getState());

  useEffect(() => {
    return syncManager.subscribe(setSyncInfo);
  }, []);

  // Toast Queue Manager: Max 3 visible, ~2.5s duration
  const addToast = useCallback((notif: Notification) => {
    setToasts((prev) => {
      const newItem: ToastItem = {
        id: `toast-${notif.id}-${Date.now()}`,
        notification: notif,
        enteredAt: Date.now(),
      };
      if (prev.length >= 3) {
        return [...prev.slice(1), newItem];
      }
      return [...prev, newItem];
    });
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const addNotification = useCallback(
    (notif: Notification) => {
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
      addToast(notif);
    },
    [addToast]
  );

  // Auto-expire toasts
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.enteredAt < 2500));
    }, 200);
    return () => clearInterval(timer);
  }, [toasts]);

  // Load diagnosis for a specific zone
  const loadZoneDiagnosis = useCallback(async (zoneId: string): Promise<DiagnosisResult | null> => {
    try {
      const diag = await fetchZoneDiagnosis(zoneId);
      if (zoneId.toUpperCase() === activeZoneId.toUpperCase()) {
        setActiveDiagnosis(diag);
      }
      return diag;
    } catch (e) {
      console.warn(`[FarmContext] Error loading diagnosis for ${zoneId}:`, e);
      return null;
    }
  }, [activeZoneId]);

  // Initial Data Load (both Zones and Farm summary)
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load zones
      const zonesData = await fetchZones();
      setZones(zonesData);

      // Load active zone diagnosis
      const diag = await fetchZoneDiagnosis(activeZoneId);
      setActiveDiagnosis(diag);

      // Load legacy farm summary for Admin views
      const summary = await fetchFarmSummary();
      setFarmSummary(summary);
      setFields(summary.fields);
    } catch (err: any) {
      setError(err.message || "Failed to load farm state");
    } finally {
      setLoading(false);
    }
  }, [activeZoneId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh active zone diagnosis whenever activeZoneId changes
  useEffect(() => {
    loadZoneDiagnosis(activeZoneId);
  }, [activeZoneId, loadZoneDiagnosis]);

  // Real-time WebSocket connection
  useEffect(() => {
    wsClient.connect();
    const unsubStatus = wsClient.onStatus(setConnectionStatus);

    const unsubEvents = wsClient.onEvent((event: WebSocketEvent) => {
      if (event.event === "zone.updated") {
        const updatedZone: Zone = event.payload;
        setZones((prev) => prev.map((z) => (z.zone_id === updatedZone.zone_id ? updatedZone : z)));
        offlineStorage.saveZones([updatedZone]).catch(() => {});
      } else if (event.event === "diagnosis.created") {
        const diag: DiagnosisResult = event.payload;
        if (diag.zone_id.toUpperCase() === activeZoneId.toUpperCase()) {
          setActiveDiagnosis(diag);
        }
        offlineStorage.saveDiagnosis(diag).catch(() => {});
      } else if (event.event === "farm.updated") {
        const payload: FarmSummary = event.payload;
        setFarmSummary(payload);
        setFields(payload.fields);
      } else if (event.event === "field.updated") {
        const updated: FieldSummary = event.payload;
        setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      } else if (event.event === "notification.created") {
        const notif: Notification = event.payload;
        setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
        addToast(notif);
        offlineStorage.saveAlerts([notif]).catch(() => {});
      } else if (event.event === "notification.resolved") {
        const payload = event.payload;
        setNotifications((prev) =>
          prev.map((n) => (n.id === payload.notificationId ? { ...n, status: "resolved" } : n))
        );
      }
    });

    return () => {
      unsubStatus();
      unsubEvents();
      wsClient.disconnect();
    };
  }, [activeZoneId, addToast]);

  const markRecommendationReviewedAction = useCallback(async (recId: string) => {
    await reviewRecommendation(recId);
  }, []);

  const resolveNotifAction = useCallback(async (notifId: string) => {
    await resolveNotification(notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, status: "resolved" } : n))
    );
  }, []);

  const acknowledgeAction = useCallback(
    async (zoneId: string, action: string, recommendationId?: string) => {
      await acknowledgeFarmerAction(zoneId, action, recommendationId);
      // Mark local diagnosis updated
      if (activeDiagnosis && activeDiagnosis.zone_id === zoneId) {
        addToast({
          id: `ack-${Date.now()}`,
          farmId: "farm-demo",
          fieldId: zoneId,
          severity: "info",
          type: "crop_health",
          title: "Action Recorded",
          message: `Logged: ${action}`,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    },
    [activeDiagnosis, addToast]
  );

  const toggleSimulatedOffline = useCallback(() => {
    const isCurrentlyOffline = syncInfo.network === "offline";
    syncManager.setSimulatedOffline(!isCurrentlyOffline);
  }, [syncInfo.network]);

  const flushSyncQueue = useCallback(async () => {
    await syncManager.flushQueue();
  }, []);

  const activeZone = useMemo(() => {
    return zones.find((z) => z.zone_id.toUpperCase() === activeZoneId.toUpperCase()) || null;
  }, [zones, activeZoneId]);

  const activeNotificationsCount = farmSummary?.activeNotifications ?? notifications.filter((n) => n.status === "active").length;

  return (
    <FarmContext.Provider
      value={{
        farmSummary,
        fields,
        connectionStatus,
        notifications,
        activeNotificationsCount,
        toasts,
        dismissToast,
        addNotification,
        markRecommendationReviewed: markRecommendationReviewedAction,
        resolveNotif: resolveNotifAction,
        refresh: loadData,
        loading,
        error,

        // V2
        zones,
        activeZoneId,
        setActiveZoneId,
        activeZone,
        activeDiagnosis,
        loadZoneDiagnosis,
        acknowledgeAction,

        // Offline / Sync
        network: syncInfo.network,
        syncState: syncInfo.syncState,
        pendingSyncCount: syncInfo.pendingCount,
        lastSyncedAt: syncInfo.lastSyncedAt,
        toggleSimulatedOffline,
        flushSyncQueue,

        // Navigation
        interfaceMode,
        setInterfaceMode,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export function useFarm(): FarmContextType {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error("useFarm must be used within a FarmProvider");
  }
  return context;
}
