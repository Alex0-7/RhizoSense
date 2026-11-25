import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, AlertTriangle, CheckCircle2, RefreshCw, Cpu } from "lucide-react";
import { VisionDetectionResult, Notification } from "../../types";
import { fetchVisionDetection, simulateVisionDetection, submitVisionDetection } from "../../services/api";
import { useFarm } from "../../state/FarmContext";
import { SyncedCropVideoPlayer } from "./SyncedCropVideoPlayer";
import { TimelineDetectionCue } from "../../config/visionMedia";

interface EdgeVisionPanelProps {
  fieldId: string;
  fieldName: string;
}

export const EdgeVisionPanel: React.FC<EdgeVisionPanelProps> = ({ fieldId, fieldName }) => {
  const { addNotification } = useFarm();

  const [detection, setDetection] = useState<VisionDetectionResult>({
    detected: true,
    disease: "Leaf Blotch",
    confidence: 0.89,
  });
  const [autoTimeline, setAutoTimeline] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const lastDetectedRef = useRef<boolean | null>(null);

  // Fetch initial detection state from backend
  useEffect(() => {
    let isMounted = true;
    async function loadDetection() {
      try {
        const data = await fetchVisionDetection(fieldId);
        if (isMounted && data) {
          setDetection(data);
          // Set initial ref to avoid duplicate alert on initial load if already true
          if (lastDetectedRef.current === null) {
            lastDetectedRef.current = data.detected;
          }
        }
      } catch {
        // Retain deterministic fallback if backend is offline
        if (isMounted && lastDetectedRef.current === null) {
          lastDetectedRef.current = true;
        }
      }
    }
    loadDetection();
    return () => {
      isMounted = false;
    };
  }, [fieldId]);

  // Handle transition from false -> true to fire exactly ONE warning notification
  useEffect(() => {
    if (lastDetectedRef.current === false && detection.detected === true) {
      const diseaseName = detection.disease || "Crop Disease";
      const confPercent = Math.round(detection.confidence * 100);
      const newNotif: Notification = {
        id: `notif-vision-${fieldId}-${Date.now()}`,
        farmId: "farm-demo",
        fieldId: fieldId,
        severity: "warning",
        type: "disease",
        title: `${diseaseName} detected in ${fieldName}`,
        message: `Edge vision model detected ${diseaseName} with ${confPercent}% confidence.`,
        status: "active",
        recommendation: "Inspect foliage on lower stems and apply targeted fungicidal protocol.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addNotification(newNotif);
    }
    lastDetectedRef.current = detection.detected;
  }, [detection, fieldId, fieldName, addNotification]);

  // Toggle simulated detection state (deterministic)
  const handleToggleSimulation = async () => {
    if (simulating) return;
    setSimulating(true);
    const targetState = !detection.detected;
    try {
      const updated = await simulateVisionDetection(fieldId, targetState);
      setDetection(updated);
    } catch {
      // Fallback local deterministic simulation if backend unavailable
      setDetection({
        detected: targetState,
        disease: targetState ? "Early Blight" : null,
        confidence: targetState ? 0.91 : 0.12,
      });
    } finally {
      setSimulating(false);
    }
  };

  const handleCueTransition = useCallback(
    async (cue: TimelineDetectionCue) => {
      const nextResult: VisionDetectionResult = {
        detected: cue.severity !== "healthy",
        disease: cue.severity === "healthy" ? null : cue.label,
        confidence: cue.confidence,
      };
      setDetection(nextResult);
      try {
        await submitVisionDetection(nextResult, fieldId);
      } catch {
        // Offline resilient
      }
    },
    [fieldId]
  );

  const confidencePercent = Math.round((detection.confidence || 0) * 100);

  return (
    <div className="rounded-card border border-borderDefault bg-surface shadow-card overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-borderDefault flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-secondary/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primaryText text-white flex items-center justify-center shrink-0">
            <Camera size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-primaryText">Edge Vision & Plant Pathology</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface border border-borderDefault text-secondaryText">
                Vision Demo
              </span>
            </div>
            <p className="text-xs text-secondaryText mt-0.5">
              Simulated canopy camera feed processed by Qualcomm Edge AI visual inference model
            </p>
          </div>
        </div>

        {/* Simulation Action Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSimulation}
            disabled={simulating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-surface border border-borderDefault text-secondaryText hover:text-primaryText hover:border-borderStrong text-xs font-medium transition-colors shadow-sm disabled:opacity-60"
            title="Toggle between disease detected and clear canopy states"
          >
            <RefreshCw size={13} className={simulating ? "animate-spin" : ""} />
            <span>{detection.detected ? "Simulate Clear Canopy" : "Simulate Disease (Early Blight)"}</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Synchronized Self-Playing Plant Video Feed (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <SyncedCropVideoPlayer
            presetId="rhizome_rot_canopy.mp4"
            zoneLabel={`${fieldName.toUpperCase()} CANOPY`}
            autoTimelineEnabled={autoTimeline}
            onToggleAutoTimeline={setAutoTimeline}
            onCueTransition={handleCueTransition}
            externalConditionLabel={detection.detected ? detection.disease || "Leaf Blotch" : "HEALTHY CANOPY"}
            externalConfidencePercent={confidencePercent}
            externalIsHealthy={!detection.detected}
            isProcessing={simulating}
            badgeRightText="720p · SYNCED FPO + FARMER"
          />
        </div>

        {/* Right: Visual Detection Result Panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-secondaryText mb-2">
              Visual Detection Result
            </div>

            {detection.detected ? (
              /* WARNING STATE */
              <div className="p-4 rounded-card border border-status-warning-border bg-status-warning-bg transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FDF3E7] text-status-warning flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-status-warning">
                        Warning
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/80 border border-status-warning-border text-status-warning">
                        Pathology Identified
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-primaryText mt-1">
                      {detection.disease || "Early Blight"} detected
                    </h4>

                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-secondaryText font-medium">Confidence:</span>
                        <strong className="text-primaryText font-semibold">{confidencePercent}%</strong>
                      </div>
                      {/* Confidence Meter */}
                      <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-status-warning-border/60">
                        <div
                          className="h-full bg-status-warning rounded-full transition-all duration-500"
                          style={{ width: `${confidencePercent}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-secondaryText mt-3 leading-relaxed">
                      Leaf foliage displays concentric necrotic lesions typical of fungal blight. Recommended foliar inspection protocol triggered.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* NOMINAL STATE */
              <div className="p-4 rounded-card border border-[#C3E4CD] bg-[#EBF5EE] transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-status-normal flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-status-normal">
                        Nominal
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-[#C3E4CD] text-status-normal">
                        Foliage Healthy
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-primaryText mt-1">
                      No disease detected
                    </h4>

                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-secondaryText font-medium">Confidence:</span>
                        <strong className="text-primaryText font-semibold">{confidencePercent}%</strong>
                      </div>
                      {/* Baseline Noise Meter */}
                      <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-[#C3E4CD]">
                        <div
                          className="h-full bg-status-normal rounded-full transition-all duration-500"
                          style={{ width: `${confidencePercent}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-secondaryText mt-3 leading-relaxed">
                      Canopy foliage exhibits uniform chlorophyll coloration and healthy leaf architecture without signs of chlorosis or fungal spots.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Model Contract Note */}
          <div className="p-3 rounded-md bg-surface-secondary/60 border border-borderDefault/80 text-[11px] text-secondaryText space-y-1.5">
            <div className="flex items-center gap-1.5 text-primaryText font-medium">
              <Cpu size={13} />
              <span>CV Model Contract (3 Fields)</span>
            </div>
            <pre className="font-mono text-[10px] bg-white p-2 rounded border border-borderDefault text-secondaryText overflow-x-auto">
{JSON.stringify(
  {
    detected: detection.detected,
    disease: detection.disease,
    confidence: detection.confidence,
  },
  null,
  2
)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
