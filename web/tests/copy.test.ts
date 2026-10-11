import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PlanWarning } from "../src/app/planTrek.ts";
import { step } from "../src/domain/offline.ts";
import { estimateText, offlineBadgeText, offlineStepText, offlineSummaryText, warningText } from "../src/ui/copy.ts";

describe("estimateText", () => {
  it("compares the learned estimate with the rule of thumb", () => {
    assert.equal(
      estimateText({ minutes: 125, baselineMinutes: 96, source: "tabpfn" }),
      "Climb about 2 h 5 min at your pace, 29 min slower than the rule of thumb.",
    );
    assert.equal(
      estimateText({ minutes: 80, baselineMinutes: 96, source: "tabpfn" }),
      "Climb about 1 h 20 min at your pace, 16 min faster than the rule of thumb.",
    );
    assert.match(estimateText({ minutes: 98, baselineMinutes: 96, source: "tabpfn" }), /about the same/);
  });

  it("is honest when only the rule of thumb is available", () => {
    assert.equal(estimateText({ minutes: 96, baselineMinutes: 96, source: "naismith" }), "Climb about 1 h 36 min (rule of thumb).");
  });
});

describe("warningText", () => {
  it("has a sentence for every warning", () => {
    const all: PlanWarning[] = ["offline-estimate", "unknown-last-departure", "does-not-fit", "unverified-data"];
    for (const w of all) assert.match(warningText(w), /\.$/);
  });
});

describe("offline copy", () => {
  it("labels the badge for each state", () => {
    assert.equal(offlineBadgeText("off", 0, false), "Use offline");
    assert.equal(offlineBadgeText("off", 0, true), "Finish offline");
    assert.equal(offlineBadgeText("working", 0.426, true), "Saving 42%");
    assert.equal(offlineBadgeText("ready", 1, true), "Offline ready");
  });

  it("explains each step, including what to do", () => {
    assert.match(offlineStepText(step("guide", "missing")), /Wi-Fi/);
    assert.match(offlineStepText(step("files", "working", 0.5, "15 of 30 files")), /15 of 30/);
    assert.match(offlineStepText(step("guide", "done", 1, "gemma3-1b")), /gemma3-1b/);
    assert.match(offlineStepText(step("guide", "failed")), /try again/);
    assert.match(offlineStepText(step("guide", "unsupported", 0, "No WebGPU.")), /No WebGPU\. Plan and Listen still work/);
  });

  it("says what to do next when ready", () => {
    assert.match(offlineSummaryText("ready"), /airplane mode/);
    assert.match(offlineSummaryText("off"), /Wi-Fi/);
  });
});
