import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PlanWarning } from "../src/app/planTrek.ts";
import { downloadStatusText, estimateText, warningText } from "../src/ui/copy.ts";

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

describe("warningText / downloadStatusText", () => {
  it("has a sentence for every warning", () => {
    const all: PlanWarning[] = ["offline-estimate", "unknown-last-departure", "does-not-fit", "unverified-data"];
    for (const w of all) assert.match(warningText(w), /\.$/);
  });

  it("tells the user what to do when the guide is missing", () => {
    assert.match(downloadStatusText("missing"), /Wi-Fi/);
    assert.match(downloadStatusText("ready"), /no signal/);
  });
});
