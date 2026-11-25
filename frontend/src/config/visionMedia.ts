export interface VideoPresetSource {
  id: string;
  label: string;
  remoteUrl: string;
  fallbackLocalUrl: string;
  defaultCondition: "rhizome_rot" | "leaf_blotch" | "early_blight" | "healthy";
}

export interface TimelineDetectionCue {
  id: string;
  startSec: number;
  endSec: number;
  label: string;
  conditionOverride: "healthy" | "leaf_blotch" | "rhizome_rot" | "early_blight";
  confidence: number;
  severity: "healthy" | "warning" | "critical";
  box: { top: string; left: string; width: string; height: string };
  summary: string;
}

export const VISION_PRESET_SOURCES: Record<string, VideoPresetSource> = {
  "rhizome_rot_canopy.mp4": {
    id: "rhizome_rot_canopy.mp4",
    label: "Turmeric Canopy Field Feed (Zone B3)",
    remoteUrl: "https://assets.mixkit.co/videos/15385/15385-720.mp4",
    fallbackLocalUrl: "/vision/plant-feed.mp4",
    defaultCondition: "rhizome_rot",
  },
  "turmeric_leaf_blotch.mp4": {
    id: "turmeric_leaf_blotch.mp4",
    label: "Greenhouse Foliage Pathology Scan",
    remoteUrl: "https://assets.mixkit.co/videos/47274/47274-720.mp4",
    fallbackLocalUrl: "/vision/plant-feed.mp4",
    defaultCondition: "leaf_blotch",
  },
  "early_blight_foliage.mp4": {
    id: "early_blight_foliage.mp4",
    label: "Canopy Early Blight Inspection",
    remoteUrl: "https://assets.mixkit.co/videos/1709/1709-720.mp4",
    fallbackLocalUrl: "/vision/plant-feed.mp4",
    defaultCondition: "early_blight",
  },
  "healthy_crop_control.mp4": {
    id: "healthy_crop_control.mp4",
    label: "Healthy Crop Close-Up (Control)",
    remoteUrl: "https://assets.mixkit.co/videos/33422/33422-720.mp4",
    fallbackLocalUrl: "/vision/plant-feed.mp4",
    defaultCondition: "healthy",
  },
};

/**
 * Deterministic timestamp-synced cues mapped to real video playback seconds.
 * Allows seamless automated disease progression during demo & video presentations.
 */
export const DETECTION_TIMELINE_CUES: TimelineDetectionCue[] = [
  {
    id: "cue-healthy",
    startSec: 0,
    endSec: 4.0,
    label: "HEALTHY CANOPY",
    conditionOverride: "healthy",
    confidence: 0.96,
    severity: "healthy",
    box: { top: "24%", left: "26%", width: "44%", height: "48%" },
    summary: "Baseline optical sweep: uniform chlorophyll spectral index.",
  },
  {
    id: "cue-blotch",
    startSec: 4.0,
    endSec: 9.0,
    label: "LEAF BLOTCH",
    conditionOverride: "leaf_blotch",
    confidence: 0.89,
    severity: "warning",
    box: { top: "28%", left: "30%", width: "40%", height: "42%" },
    summary: "Foliar Taphrina maculans blotch lesions isolated in ROI #01.",
  },
  {
    id: "cue-rot",
    startSec: 9.0,
    endSec: 999,
    label: "RHIZOME ROT",
    conditionOverride: "rhizome_rot",
    confidence: 0.91,
    severity: "critical",
    box: { top: "22%", left: "22%", width: "50%", height: "52%" },
    summary: "Vascular wilting + saturated root telemetry corroborated (Action Required).",
  },
];

export function getTimelineCueForTime(seconds: number, presetId: string): TimelineDetectionCue {
  if (presetId === "healthy_crop_control.mp4") {
    return DETECTION_TIMELINE_CUES[0];
  }
  const match = DETECTION_TIMELINE_CUES.find(
    (c) => seconds >= c.startSec && seconds < c.endSec
  );
  return match || DETECTION_TIMELINE_CUES[DETECTION_TIMELINE_CUES.length - 1];
}
