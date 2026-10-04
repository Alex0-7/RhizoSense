import React, { useState } from "react";
import { CheckCircle2, ShieldAlert, Check } from "lucide-react";
import { Recommendation } from "../../types";
import { StatusBadge } from "../status/StatusBadge";

interface RecommendationCardProps {
  recommendation: Recommendation;
  onMarkReviewed?: (recId: string) => Promise<void>;
  className?: string;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onMarkReviewed,
  className = "",
}) => {
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState(recommendation.reviewed);

  const handleReview = async () => {
    if (reviewed || loading || !onMarkReviewed) return;
    setLoading(true);
    try {
      await onMarkReviewed(recommendation.id);
      setReviewed(true);
    } catch (e) {
      console.error("Failed to mark reviewed:", e);
    } finally {
      setLoading(false);
    }
  };

  const isCritical = recommendation.priority === "critical";

  return (
    <div
      className={`rounded-card border p-5 shadow-card transition-colors ${
        isCritical
          ? "bg-status-critical-bg/40 border-status-critical-border"
          : "bg-surface border-borderDefault"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              isCritical ? "bg-[#FBEAEA] text-status-critical" : "bg-blue-50 text-blue-600"
            }`}
          >
            <ShieldAlert size={16} />
          </div>
          <h3 className="text-sm font-semibold text-primaryText uppercase tracking-wider">
            Operational Recommendation
          </h3>
        </div>
        <StatusBadge status={recommendation.priority} size="sm" />
      </div>

      <div className="my-2">
        <h4 className="text-base font-semibold text-primaryText">{recommendation.action}</h4>
        <div className="mt-2 text-xs text-secondaryText bg-surface p-3 rounded-lg border border-borderDefault/60">
          <strong className="text-primaryText block mb-1">Agronomic Rationale:</strong>
          {recommendation.reason}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-borderDefault/60 flex items-center justify-between">
        <span className="text-[11px] text-mutedText">
          Generated {new Date(recommendation.generatedAt).toLocaleTimeString()}
        </span>

        {reviewed ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#265C39] bg-[#EBF5EE] px-3 py-1 rounded-btn">
            <Check size={14} />
            <span>Marked as Reviewed</span>
          </span>
        ) : (
          <button
            onClick={handleReview}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-btn text-xs font-medium transition-colors shadow-sm ${
              isCritical
                ? "bg-status-critical text-white hover:bg-[#B33E3E]"
                : "bg-primaryText text-white hover:bg-black"
            }`}
          >
            <CheckCircle2 size={14} />
            <span>{loading ? "Updating..." : "Mark as Reviewed"}</span>
          </button>
        )}
      </div>
    </div>
  );
};
