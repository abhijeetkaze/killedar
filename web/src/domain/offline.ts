// What "works offline" means for Killedar, as plain data: the app's own files (shell, fort notes,
// TabPFN's climb times, narration) and the on-device Gemma guide. Pure, so the UI is testable.

export type StepId = "files" | "guide";

/** "no-space": the browser refused to store more (phone full, or a private/incognito window). */
export type StepStatus = "missing" | "working" | "done" | "unsupported" | "failed" | "no-space";

export interface OfflineStep {
  id: StepId;
  status: StepStatus;
  /** 0..1 */
  fraction: number;
  /** Short progress text, e.g. "12 of 30 files" or WebLLM's download message. */
  detail: string;
}

export interface OfflineReport {
  files: OfflineStep;
  guide: OfflineStep;
}

/** "off": nothing to show yet · "working": downloading · "partial": some of it · "ready": all of it. */
export type OfflineOverall = "off" | "working" | "partial" | "ready";

/**
 * Ready once the app files are stored and the guide is stored, or can't run on this browser
 * anyway (no WebGPU): then Plan and Listen still work offline, and Ask says why it can't.
 */
export function overallStatus(r: OfflineReport): OfflineOverall {
  const steps = [r.files, r.guide];
  if (steps.some((s) => s.status === "working")) return "working";
  const filesOk = r.files.status === "done";
  const guideOk = r.guide.status === "done" || r.guide.status === "unsupported";
  if (filesOk && guideOk) return "ready";
  if (r.guide.status === "done") return "partial";
  return "off";
}

/**
 * One number for the badge. The guide is hundreds of MB and the files a few hundred KB,
 * so weight by rough size rather than step count.
 */
export function overallFraction(r: OfflineReport): number {
  const guideCounts = r.guide.status !== "unsupported";
  const fileWeight = guideCounts ? 0.02 : 1;
  const done = (s: OfflineStep) => (s.status === "done" ? 1 : clamp01(s.fraction));
  return clamp01(fileWeight * done(r.files) + (guideCounts ? (1 - fileWeight) * done(r.guide) : 0));
}

/** True for the browser's "storage full" error, however the library wrapped it. */
export function isNoSpaceError(e: unknown): boolean {
  for (let cur = e, depth = 0; cur && depth < 4; cur = (cur as { cause?: unknown }).cause, depth++) {
    const { name, message } = cur as { name?: unknown; message?: unknown };
    if (name === "QuotaExceededError" || (typeof message === "string" && /quota/i.test(message))) return true;
  }
  return false;
}

/** WebLLM's progress line, without its trailing advice: "Fetching param cache[26/42]: 720MB fetched. 51% completed". */
export function shortProgressText(text: string): string {
  return text.split(/,? \d+ secs? elapsed| It can take/)[0]?.trim() ?? text;
}

export function step(id: StepId, status: StepStatus, fraction = status === "done" ? 1 : 0, detail = ""): OfflineStep {
  return { id, status, fraction: clamp01(fraction), detail };
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
