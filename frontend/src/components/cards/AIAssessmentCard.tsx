import React from "react";
import { BrainCircuit, Sparkles } from "lucide-react";
import { AIAssessment } from "../../types";

interface AIAssessmentCardProps {
  assessment: AIAssessment;
  className?: string;
}

export const AIAssessmentCard: React.FC<AIAssessmentCardProps> = ({ assessment, className = "" }) => {
  return (
    <div className={`rounded-card border border-borderDefault bg-surface p-5 shadow-card ${className}`}>
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BrainCircuit size={16} />
          </div>
          <h3 className="text-sm font-semibold text-primaryText uppercase tracking-wider">
            AI Domain Assessment
          </h3>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-secondary text-xs font-semibold text-secondaryText">
          <Sparkles size={12} className="text-blue-500" />
          <span>Confidence: {assessment.confidencePercent}%</span>
        </div>
      </div>

      <div>
        <h4 className="text-base font-semibold text-primaryText">{assessment.title}</h4>
        <p className="text-xs text-secondaryText mt-1 leading-relaxed">{assessment.summary}</p>
      </div>

      <div className="mt-4 pt-3.5 border-t border-borderDefault/60">
        <span className="text-xs font-semibold text-secondaryText uppercase tracking-wider block mb-2">
          Contributing Agronomic Indicators
        </span>
        <ul className="space-y-2">
          {assessment.indicators.map((ind) => (
            <li
              key={ind.id}
              className="flex items-center justify-between text-xs p-2 rounded bg-surface-secondary/50 border border-borderDefault/40"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="font-medium text-primaryText">{ind.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {ind.value && <strong className="text-primaryText">{ind.value}</strong>}
                {ind.contribution && (
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      ind.contribution === "high"
                        ? "bg-red-50 text-red-700"
                        : ind.contribution === "medium"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {ind.contribution} weight
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {assessment.model && (
        <div className="mt-3.5 pt-2.5 border-t border-borderDefault/50 flex items-center justify-between text-[11px] text-mutedText font-mono">
          <span>Inference: {assessment.model.name}</span>
          <span>v{assessment.model.version}</span>
        </div>
      )}
    </div>
  );
};
