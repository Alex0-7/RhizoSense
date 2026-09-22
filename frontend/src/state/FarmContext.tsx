import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { FarmSummary, FieldSummary, Notification, ConnectionStatus, WebSocketEvent } from "../types";
import { fetchFarmSummary, resolveNotification, reviewRecommendation } from "../services/api";
import { wsClient } from "../services/websocket";

export interface ToastItem {
  id: string;
  notification: Notification;
  enteredAt: number;
}

interface FarmContextType {
  farmSummary: FarmSummary | null;
  fields: FieldSummary[];
  connectionStatus: ConnectionStatus;
  notifications: Notification[];
  activeNotificationsCount: number;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  markRecommendationReviewed: (recId: string) => Promise<void>;
  resolveNotif: (notifId: string) => Promise<void>;
  refresh: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [farmSummary, setFarmSummary] = useState<FarmSummary | null>(null);
  const [fields, setFields] = useState<FieldSummary[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Toast Queue Manager: Max 3 visible, ~2.5s duration
  const addToast = useCallback((notif: Notification) => {
    setToasts((prev) => {
      const newItem: ToastItem = {
        id: `toast-${notif.id}-${Date.now()}`,
        notification: notif,
        enteredAt: Date.now(),
      };
      // If 3 are already visible, remove oldest (index 0) and append new
      if (prev.length >= 3) {
        return [...prev.slice(1), newItem];
      }
      return [...prev, newItem];
    });
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // Auto-expire toasts after ~2500ms
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.enteredAt < 2500));
    }, 200);
    return () => clearInterval(timer);
  }, [toasts]);

  // Initial load
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchFarmSummary();
      setFarmSummary(data);
      setFields(data.fields);
    } catch (err: any) {
      setError(err.message || "Failed to load farm data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time WebSocket connection
  useEffect(() => {
    wsClient.connect();
    const unsubStatus = wsClient.onStatus(setConnectionStatus);

    const unsubEvents = wsClient.onEvent((event: WebSocketEvent) => {
      if (event.event === "farm.updated") {
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
  }, [addToast]);

  const markRecommendationReviewedAction = useCallback(async (recId: string) => {
    await reviewRecommendation(recId);
  }, []);

  const resolveNotifAction = useCallback(async (notifId: string) => {
    await resolveNotification(notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, status: "resolved" } : n))
    );
  }, []);

  const activeNotificationsCount = farmSummary?.activeNotifications ?? 0;

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
        markRecommendationReviewed: markRecommendationReviewedAction,
        resolveNotif: resolveNotifAction,
        refresh: loadData,
        loading,
        error,
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
