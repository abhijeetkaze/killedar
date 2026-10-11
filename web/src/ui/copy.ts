// User-facing wording, kept pure so it is tested and consistent across screens.

import type { PlanWarning } from "../app/planTrek.ts";
import { formatDuration } from "../domain/plan.ts";
import type { OfflineOverall, OfflineStep, StepId } from "../domain/offline.ts";
import type { ClimbEstimate } from "../ports/climbPredictor.ts";

export function warningText(w: PlanWarning): string {
  switch (w) {
    case "offline-estimate":
      return "Couldn't work out your personal climb time, so it uses the rule of thumb.";
    case "unknown-last-departure":
      return "Enter the last bus or train back from the base to get a leave-by time.";
    case "does-not-fit":
      return "This doesn't fit in one day. Pick a shorter trail, less time on top, or plan to stay over.";
    case "unverified-data":
      return "Trail details for this fort aren't verified yet. Confirm timings locally.";
  }
}

export function estimateText(e: ClimbEstimate): string {
  const climb = formatDuration(e.minutes);
  if (e.source === "naismith") return `Climb about ${climb} (rule of thumb).`;
  const diff = e.minutes - e.baselineMinutes;
  const vs =
    Math.abs(diff) < 5
      ? "about the same as the rule of thumb"
      : `${formatDuration(Math.abs(diff))} ${diff > 0 ? "slower" : "faster"} than the rule of thumb`;
  return `Climb about ${climb} at your pace, ${vs}.`;
}

export function offlineBadgeText(overall: OfflineOverall, fraction: number, wanted: boolean): string {
  switch (overall) {
    case "working":
      return `Saving ${Math.floor(fraction * 100)}%`;
    case "ready":
      return "Offline ready";
    case "partial":
      return "Finish offline";
    case "off":
      return wanted ? "Finish offline" : "Use offline";
  }
}

export function offlineStepTitle(id: StepId): string {
  return id === "files" ? "App, fort notes and your climb times" : "Gemma trail guide, for Ask";
}

export function offlineStepText(s: OfflineStep): string {
  switch (s.status) {
    case "done":
      return s.id === "files" ? "Saved on this phone." : `Saved on this phone${s.detail ? ` (${s.detail})` : ""}.`;
    case "working":
      return s.detail || "Starting…";
    case "missing":
      return s.id === "files" ? "Under 1 MB." : "About 0.7–1.5 GB, once. Use Wi-Fi.";
    case "failed":
      return "Download stopped. Check your connection and try again.";
    case "unsupported":
      return `Ask can't run on this browser: ${s.detail} Plan and Listen still work offline.`;
  }
}

export function offlineSummaryText(overall: OfflineOverall): string {
  switch (overall) {
    case "ready":
      return "Ready for the fort. Turn on airplane mode and try it.";
    case "working":
      return "Keep this page open until it finishes. You can close this panel.";
    case "partial":
    case "off":
      return "Save everything once on Wi-Fi. After that Killedar works with no signal.";
  }
}
