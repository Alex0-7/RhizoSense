import React from "react";
import { Link } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";
import { Notification } from "../../types";
import { SeverityIcon } from "../status/SeverityIcon";

interface NotificationToastProps {
  notification: Notification;
  onDismiss: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onDismiss }) => {
  const isCritical = notification.severity === "critical";
  const isWarning = notification.severity === "warning";
  const isAdvisory = notification.severity === "advisory";

  const containerClasses = isCritical
    ? "bg-status-critical-bg border-status-critical-border text-status-critical-text"
    : isWarning
    ? "bg-status-warning-bg border-status-warning-border text-status-warning-text"
    : isAdvisory
    ? "bg-status-advisory-bg border-status-advisory-border text-status-advisory-text"
    : "bg-surface border-borderDefault text-primaryText";

  return (
    <div
      role="alert"
      className={`w-80 sm:w-96 rounded-card border shadow-toast p-3.5 transition-all duration-200 transform translate-y-0 opacity-100 ${containerClasses}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 shrink-0">
            <SeverityIcon
              status={notification.severity}
              size={18}
              className={isCritical ? "animate-pulse-subtle" : ""}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">
                {notification.severity}
              </span>
              {notification.fieldId && (
                <span className="text-[11px] font-medium opacity-80">
                  · {notification.fieldId.replace("-", " ").toUpperCase()}
                </span>
              )}
            </div>
            <h4 className="text-xs font-semibold text-primaryText mt-0.5 leading-snug">
              {notification.title}
            </h4>
            <p className="text-[11px] text-secondaryText mt-1 line-clamp-2 leading-relaxed">
              {notification.message}
            </p>

            {notification.fieldId && (
              <div className="mt-2 flex items-center gap-2">
                <Link
                  to={`/fields/${notification.fieldId}`}
                  onClick={onDismiss}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primaryText hover:underline"
                >
                  <span>View Field</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-secondaryText hover:text-primaryText p-1 rounded-sm hover:bg-black/5 transition-colors"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
