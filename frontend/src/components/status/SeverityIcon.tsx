import React from "react";
import { CircleCheck, Info, AlertTriangle, AlertCircle } from "lucide-react";
import type { Status, NotificationSeverity } from "../../types";

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
