import React from "react";
import { CircleCheck, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { Status, NotificationSeverity } from "../../types";

interface SeverityIconProps {
  status: Status | NotificationSeverity;
  className?: string;
  size?: number;
}

export const SeverityIcon: React.FC<SeverityIconProps> = ({ status, className = "", size = 16 }) => {
  switch (status) {
    case "critical":
      return <AlertCircle size={size} className={`text-status-critical ${className}`} />;
    case "warning":
      return <AlertTriangle size={size} className={`text-status-warning ${className}`} />;
    case "advisory":
      return <Info size={size} className={`text-status-advisory ${className}`} />;
    case "info":
      return <Info size={size} className={`text-secondaryText ${className}`} />;
    case "normal":
    default:
      return <CircleCheck size={size} className={`text-status-normal ${className}`} />;
  }
};

interface StatusBadgeProps {
  status: Status;
  size?: "sm" | "md";
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md", className = "" }) => {
  const isSm = size === "sm";

  const config = {
    normal: {
      label: "Normal",
      bg: "bg-[#EBF5EE]",
      border: "border-[#C2E2CC]",
      text: "text-[#265C39]",
    },
    advisory: {
      label: "Advisory",
      bg: "bg-status-advisory-bg",
      border: "border-status-advisory-border",
      text: "text-status-advisory-text",
    },
    warning: {
      label: "Warning",
      bg: "bg-status-warning-bg",
      border: "border-status-warning-border",
      text: "text-status-warning-text",
    },
    critical: {
      label: "Critical",
      bg: "bg-status-critical-bg",
      border: "border-status-critical-border",
      text: "text-status-critical-text",
    },
  }[status] || {
    label: "Normal",
    bg: "bg-[#EBF5EE]",
    border: "border-[#C2E2CC]",
    text: "text-[#265C39]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.bg} ${config.border} ${config.text} ${
        isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      } ${className}`}
    >
      <SeverityIcon status={status} size={isSm ? 12 : 14} />
      <span>{config.label}</span>
    </span>
  );
};
