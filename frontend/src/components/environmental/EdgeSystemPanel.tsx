import React from "react";
import { Cpu, Camera, Radio, CloudRain, Wifi, Activity } from "lucide-react";
import { EdgeSystem } from "../../types";

interface EdgeSystemPanelProps {
  edgeSystem: EdgeSystem;
  className?: string;
}

export const EdgeSystemPanel: React.FC<EdgeSystemPanelProps> = ({ edgeSystem, className = "" }) => {
  const indicators = [
    { label: "AI Inference Engine", status: edgeSystem.aiInference, icon: Cpu, isOk: edgeSystem.aiInference === "active" },
    { label: "Spectral Canopy Camera", status: edgeSystem.camera, icon: Camera, isOk: edgeSystem.camera === "connected" },
    { label: "Soil Sensory Array", status: edgeSystem.soilSensors, icon: Radio, isOk: edgeSystem.soilSensors === "connected" },
    { label: "Micro-Weather Station", status: edgeSystem.weatherSensors, icon: CloudRain, isOk: edgeSystem.weatherSensors === "connected" },
    { label: "Local Edge Processing", status: edgeSystem.localProcessing ? "Active" : "Degraded", icon: Activity, isOk: edgeSystem.localProcessing },
    { label: "Farm Network Link", status: edgeSystem.network, icon: Wifi, isOk: edgeSystem.network === "connected" },
  ];

  return (
    <div className={`rounded-card border border-borderDefault bg-surface p-5 shadow-card ${className}`}>
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm font-semibold text-primaryText uppercase tracking-wider">
          Edge Hardware & Systems
        </h3>
        <span className="text-[11px] font-mono text-mutedText">
          {edgeSystem.version || "Qualcomm RB5-AI"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {indicators.map((ind, idx) => {
          const Icon = ind.icon;
          return (
            <div
              key={idx}
              className="p-2.5 rounded-lg border border-borderDefault/50 bg-surface-secondary/40 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Icon size={14} className="text-secondaryText" />
                <span className="text-xs text-primaryText font-medium">{ind.label}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-status-normal-text">
                <span className={`w-1.5 h-1.5 rounded-full ${ind.isOk ? "bg-status-normal" : "bg-status-warning"}`} />
                <span className="capitalize">{ind.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 pt-3 border-t border-borderDefault/60 flex items-center justify-between text-xs text-secondaryText">
        <span>Operational Telemetry Link</span>
        <span className="text-mutedText">
          Last local inference:{" "}
          <strong className="text-primaryText font-medium">
            {edgeSystem.lastInferenceAt
              ? new Date(edgeSystem.lastInferenceAt).toLocaleTimeString()
              : "Active"}
          </strong>
        </span>
      </div>
    </div>
  );
};
