import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { Notification } from "../../types";
import { SeverityIcon } from "../status/SeverityIcon";

interface NotificationRowProps {
  notification: Notification;
  onResolve?: (id: string) => Promise<void>;
}

export const NotificationRow: React.FC<NotificationRowProps> = ({ notification, onResolve }) => {
  const [resolving, setResolving] = useState(false);
  const isResolved = notification.status === "resolved";
  const isCritical = notification.severity === "critical";

  const handleResolve = async () => {
    if (isResolved || resolving || !onResolve) return;
    setResolving(true);
    try {
      await onResolve(notification.id);
    } catch (e) {
      console.error(e);
    } finally {
      setResolving(false);
    }
  };

  const bgClasses = isResolved
    ? "bg-surface-secondary/30 border-borderDefault/50 opacity-80"
    : isCritical
    ? "bg-status-critical-bg/40 border-status-critical-border"
    : notification.severity === "warning"
    ? "bg-status-warning-bg/40 border-status-warning-border"
    : notification.severity === "advisory"
    ? "bg-status-advisory-bg/30 border-status-advisory-border"
    : "bg-surface border-borderDefault";

  return (
    <div className={`p-4 rounded-card border shadow-card transition-all ${bgClasses}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <SeverityIcon
              status={notification.severity}
              size={18}
              className={isCritical && !isResolved ? "animate-pulse-subtle" : ""}
            />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-primaryText">
                {notification.severity}
              </span>
              {notification.fieldId && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface border border-borderDefault/60 text-secondaryText">
                  {notification.fieldId.replace("-", " ").toUpperCase()}
                </span>
              )}
              <span className="text-[11px] text-mutedText">
                {new Date(notification.createdAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <h4 className="text-sm font-semibold text-primaryText mt-1">{notification.title}</h4>
            <p className="text-xs text-secondaryText mt-1 leading-relaxed">{notification.message}</p>

            {notification.recommendation && (
              <div className="mt-2.5 p-2 rounded bg-surface/80 border border-borderDefault/60 text-xs text-secondaryText">
                <strong className="text-primaryText font-medium">Recommended Action: </strong>
                {notification.recommendation}
              </div>
            )}
          </div>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-borderDefault/50">
          {notification.fieldId && (
            <Link
              to={`/fields/${notification.fieldId}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primaryText hover:text-black hover:underline"
            >
              <span>View Field</span>
              <ArrowRight size={13} />
            </Link>
          )}

          {isResolved ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondaryText bg-surface px-2.5 py-1 rounded-full border border-borderDefault/60">
              <Check size={12} className="text-status-normal" />
              <span>Resolved</span>
            </span>
          ) : (
            onResolve && (
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="px-3 py-1 rounded-btn text-xs font-medium bg-surface border border-borderDefault text-secondaryText hover:text-primaryText hover:border-borderStrong transition-colors shadow-sm"
              >
                {resolving ? "Resolving..." : "Acknowledge"}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
