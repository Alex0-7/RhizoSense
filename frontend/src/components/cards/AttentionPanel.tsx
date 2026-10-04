import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { FieldSummary } from "../../types";

interface AttentionPanelProps {
  fields: FieldSummary[];
}

export const AttentionPanel: React.FC<AttentionPanelProps> = ({ fields }) => {
  // Find critical fields first, then warning fields
  const criticalFields = fields.filter((f) => f.status === "critical");
  const warningFields = fields.filter((f) => f.status === "warning");

  const activeIssueField = criticalFields[0] || warningFields[0];
  const isCritical = Boolean(criticalFields.length);

  if (!activeIssueField) {
    return (
      <div className="rounded-card border border-borderDefault bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#EBF5EE] text-status-normal flex items-center justify-center shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primaryText">Attention Required</h3>
            <p className="text-xs text-secondaryText mt-0.5">
              No critical issues detected. All 6 monitored fields are operating within nominal agronomic thresholds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const containerClasses = isCritical
    ? "bg-status-critical-bg border-status-critical-border"
    : "bg-status-warning-bg border-status-warning-border";

  const iconBg = isCritical
    ? "bg-[#FBEAEA] text-status-critical"
    : "bg-[#FDF3E7] text-status-warning";

  return (
    <div className={`rounded-card border p-5 shadow-card transition-colors duration-200 ${containerClasses}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
            {isCritical ? (
              <AlertCircle size={22} className="animate-pulse-subtle" />
            ) : (
              <AlertTriangle size={22} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-secondaryText">
                Attention Required
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isCritical ? "bg-[#FBEAEA] text-status-critical" : "bg-[#FDF3E7] text-status-warning"
                }`}
              >
                {isCritical ? "Critical" : "Warning"}
              </span>
            </div>
            <h3 className="text-base font-semibold text-primaryText mt-1">
              {activeIssueField.name}: {activeIssueField.issue || "Abnormal Agronomic Conditions"}
            </h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondaryText mt-1.5">
              <span>
                Soil Moisture: <strong className="text-primaryText">{activeIssueField.soilMoisturePercent}%</strong>
              </span>
              <span>
                Temperature: <strong className="text-primaryText">{activeIssueField.temperatureC}°C</strong>
              </span>
              <span>
                Health Score: <strong className="text-primaryText">{activeIssueField.healthPercent}%</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex sm:justify-end">
          <Link
            to={`/fields/${activeIssueField.id}`}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-btn text-xs font-medium transition-colors shadow-sm ${
              isCritical
                ? "bg-status-critical text-white hover:bg-[#B33E3E]"
                : "bg-status-warning text-white hover:bg-[#B36814]"
            }`}
          >
            <span>View Field</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};
