// User-facing wording, kept pure so it is tested and consistent across screens.

import type { PlanWarning } from "../app/planTrek.ts";
import { formatDuration } from "../domain/plan.ts";
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

export function downloadStatusText(state: "checking" | "unsupported" | "missing" | "downloading" | "ready" | "failed"): string {
  switch (state) {
    case "checking":
      return "Checking whether the trail guide is on this phone…";
    case "unsupported":
      return "This browser can't run the on-device guide.";
    case "missing":
      return "The trail guide isn't on this phone yet. Download it on Wi-Fi before you leave.";
    case "downloading":
      return "Downloading the trail guide…";
    case "ready":
      return "Ready offline. Questions work with no signal.";
    case "failed":
      return "Download stopped. Check your connection and try again.";
  }
}
