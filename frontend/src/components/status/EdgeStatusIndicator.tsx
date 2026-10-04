import React from "react";
import { ConnectionStatus } from "../../types";

interface EdgeStatusIndicatorProps {
  status: ConnectionStatus;
  className?: string;
}

export const EdgeStatusIndicator: React.FC<EdgeStatusIndicatorProps> = ({ status, className = "" }) => {
  const config = {
    connected: {
      dot: "bg-status-normal",
      label: "Edge Online",
      text: "text-secondaryText",
    },
    connecting: {
      dot: "bg-status-advisory animate-pulse",
      label: "Connecting",
      text: "text-status-advisory-text",
    },
    reconnecting: {
      dot: "bg-status-warning animate-pulse",
      label: "Reconnecting",
      text: "text-status-warning-text",
    },
    disconnected: {
      dot: "bg-mutedText",
      label: "Edge Offline",
      text: "text-mutedText",
    },
  }[status] || {
    dot: "bg-mutedText",
    label: "Edge Offline",
    text: "text-mutedText",
  };

  return (
    <div
      className={`inline-flex items-center gap-2 text-xs font-medium ${config.text} ${className}`}
      title={`Telemetry connection state: ${status}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} aria-hidden="true" />
      <span>{config.label}</span>
    </div>
  );
};
