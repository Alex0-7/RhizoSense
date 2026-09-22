import React, { useState, useMemo } from "react";
import { useFarm } from "../state/FarmContext";
import { NotificationSeverity, NotificationState } from "../types";
import { NotificationList } from "../components/notifications/NotificationList";
import { NotificationFilters } from "../components/notifications/NotificationFilters";

export const NotificationsPage: React.FC = () => {
  const { notifications, resolveNotif } = useFarm();

  const [selectedSeverity, setSelectedSeverity] = useState<NotificationSeverity | "all">("all");
  const [selectedState, setSelectedState] = useState<NotificationState | "all">("all");

  const counts = useMemo(() => {
    return {
      all: notifications.filter((n) => n.status === "active").length,
      critical: notifications.filter((n) => n.status === "active" && n.severity === "critical").length,
      warning: notifications.filter((n) => n.status === "active" && n.severity === "warning").length,
      advisory: notifications.filter((n) => n.status === "active" && n.severity === "advisory").length,
      resolved: notifications.filter((n) => n.status === "resolved").length,
    };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // If user selected resolved tab
      if (selectedState === "resolved") {
        return n.status === "resolved";
      }

      // Default to active notifications
      const matchesState = n.status === "active";
      const matchesSeverity = selectedSeverity === "all" || n.severity === selectedSeverity;

      return matchesState && matchesSeverity;
    });
  }, [notifications, selectedSeverity, selectedState]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-borderDefault flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-secondaryText uppercase tracking-wider mb-1">
            System Alerts & History
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primaryText tracking-tight">
            Notification Center
          </h1>
          <p className="text-xs text-secondaryText mt-1">
            Permanent record of agronomic anomalies, threshold transitions, and system events.
          </p>
        </div>

        <div className="text-xs text-secondaryText">
          <strong className="text-primaryText font-semibold">{counts.all}</strong> active alert{counts.all === 1 ? "" : "s"}
        </div>
      </div>

      {/* Filter Tabs */}
      <NotificationFilters
        selectedSeverity={selectedSeverity}
        onSeverityChange={setSelectedSeverity}
        selectedState={selectedState}
        onStateChange={setSelectedState}
        counts={counts}
      />

      {/* Notifications List */}
      <NotificationList notifications={filteredNotifications} onResolve={resolveNotif} />
    </div>
  );
};
