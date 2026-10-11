// Use case: "Get everything onto this phone so the app works on the fort with no signal."

import { step, type OfflineReport } from "../domain/offline.ts";
import type { LanguageModel } from "../ports/languageModel.ts";
import type { OfflineFiles } from "../ports/offlineFiles.ts";

export interface OfflineSetupDeps {
  files: OfflineFiles;
  model: LanguageModel;
  /** Where failures go so they can be debugged; the UI only shows a friendly status. */
  logError?: (context: string, error: unknown) => void;
}

const consoleError = (context: string, error: unknown) => console.error(`[Killedar] ${context}`, error);

export function makeOfflineSetup({ files, model, logError = consoleError }: OfflineSetupDeps) {
  /** What's on the phone already. Never throws: anything it can't check counts as missing. */
  async function check(): Promise<OfflineReport> {
    const [filesStep, guideStep] = await Promise.all([
      files.status().then(
        ({ stored, total }) => (stored >= total && total > 0 ? step("files", "done") : step("files", "missing", total ? stored / total : 0)),
        (e: unknown) => (logError("Couldn't check saved app files", e), step("files", "missing")),
      ),
      (async () => {
        const support = await model.checkSupport();
        if (!support.ok) return step("guide", "unsupported", 0, support.reason);
        return (await model.isCached()) ? step("guide", "done", 1, model.modelName) : step("guide", "missing");
      })().catch((e: unknown) => (logError("Couldn't check the Gemma guide", e), step("guide", "missing"))),
    ]);
    return { files: filesStep, guide: guideStep };
  }

  /** Files first (small, makes Plan and Listen work), then the guide. Reports after every change. */
  async function prepare(onUpdate: (r: OfflineReport) => void): Promise<OfflineReport> {
    const report = await check();
    const emit = () => onUpdate({ ...report });

    if (report.files.status !== "done") {
      report.files = step("files", "working", report.files.fraction);
      emit();
      try {
        await files.store((stored, total) => {
          report.files = step("files", "working", stored / total, `${stored} of ${total} files`);
          emit();
        });
        report.files = step("files", "done");
      } catch (e) {
        logError("Saving app files failed", e);
        report.files = step("files", "failed");
      }
      emit();
    }

    if (report.guide.status === "missing" || report.guide.status === "failed") {
      report.guide = step("guide", "working");
      emit();
      try {
        await model.load((p) => {
          report.guide = step("guide", "working", p.fraction, p.text);
          emit();
        });
        report.guide = step("guide", "done", 1, model.modelName);
      } catch (e) {
        logError("Downloading the Gemma guide failed", e);
        report.guide = step("guide", "failed");
      }
      emit();
    }

    await files.keep().catch((e: unknown) => logError("Couldn't ask the browser to keep storage", e));
    return report;
  }

  return { check, prepare };
}
