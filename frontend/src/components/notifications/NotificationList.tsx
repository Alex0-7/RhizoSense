import React from "react";
import { Notification, NotificationSeverity } from "../../types";
import { NotificationRow } from "./NotificationRow";

interface NotificationListProps {
  notifications: Notification[];
  onResolve?: (id: string) => Promise<void>;
}

const SEVERITY_ORDER: Record<NotificationSeverity, number> = {
  critical: 0,
  warning: 1,
  advisory: 2,
  info: 3,
};

export const NotificationList: React.FC<NotificationListProps> = ({ notifications, onResolve }) => {
  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-borderDefault rounded-card">
        <h4 className="text-sm font-semibold text-primaryText">No notifications</h4>
        <p className="text-xs text-secondaryText mt-1">
          There are no events matching your selected filter criteria.
        </p>
      </div>
    );
  }

  // Sort by severity (Critical -> Warning -> Advisory -> Info), then by timestamp descending
  const sorted = [...notifications].sort((a, b) => {
    const orderDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-3">
      {sorted.map((item) => (
        <NotificationRow key={item.id} notification={item} onResolve={onResolve} />
      ))}
    </div>
  );
};
