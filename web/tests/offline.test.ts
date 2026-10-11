import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeOfflineSetup } from "../src/app/offlineSetup.ts";
import { isNoSpaceError, overallFraction, overallStatus, shortProgressText, step, type OfflineReport } from "../src/domain/offline.ts";
import { fakeFiles, fakeModel } from "./fixtures.ts";

const report = (files: OfflineReport["files"], guide: OfflineReport["guide"]): OfflineReport => ({ files, guide });

describe("overallStatus", () => {
  it("is ready only when files and guide are both stored", () => {
    assert.equal(overallStatus(report(step("files", "done"), step("guide", "done"))), "ready");
    assert.equal(overallStatus(report(step("files", "done"), step("guide", "missing"))), "off");
    assert.equal(overallStatus(report(step("files", "missing"), step("guide", "missing"))), "off");
  });

  it("is ready without the guide when this browser can't run it", () => {
    assert.equal(overallStatus(report(step("files", "done"), step("guide", "unsupported"))), "ready");
  });

  it("reports work in progress, and a half-finished setup", () => {
    assert.equal(overallStatus(report(step("files", "done"), step("guide", "working", 0.3))), "working");
    assert.equal(overallStatus(report(step("files", "missing"), step("guide", "done"))), "partial");
  });
});

describe("overallFraction", () => {
  it("weights the guide by its size", () => {
    assert.equal(overallFraction(report(step("files", "done"), step("guide", "missing"))), 0.02);
    assert.equal(overallFraction(report(step("files", "done"), step("guide", "working", 0.5))), 0.02 + 0.98 * 0.5);
    assert.equal(overallFraction(report(step("files", "done"), step("guide", "done"))), 1);
  });

  it("counts only the files when the guide can't run here", () => {
    assert.equal(overallFraction(report(step("files", "working", 0.5), step("guide", "unsupported"))), 0.5);
  });

  it("clamps nonsense progress", () => {
    assert.equal(step("files", "working", 7).fraction, 1);
    assert.equal(step("files", "working", Number.NaN).fraction, 0);
  });
});

describe("offlineSetup", () => {
  it("checks what's on the phone without downloading anything", async () => {
    const model = fakeModel();
    const r = await makeOfflineSetup({ files: fakeFiles(10, 30), model }).check();
    assert.equal(r.files.status, "missing");
    assert.equal(r.files.fraction, 10 / 30);
    assert.equal(r.guide.status, "missing");
    assert.equal(model.loads, 0);
  });

  it("stores the files, then downloads the guide, reporting progress, then asks to keep it", async () => {
    const files = fakeFiles(28, 30);
    const updates: OfflineReport[] = [];
    const final = await makeOfflineSetup({ files, model: fakeModel() }).prepare((r) => updates.push(r));

    assert.equal(overallStatus(final), "ready");
    assert.equal(final.guide.detail, "fake-gemma");
    const details = updates.map((u) => (u.files.status === "working" ? u.files.detail : u.guide.detail)).filter(Boolean);
    assert.deepEqual(details.slice(0, 2), ["29 of 30 files", "30 of 30 files"]);
    assert.ok(details.includes("Fetching weights 50%"));
    assert.ok(updates.findIndex((u) => u.guide.status === "working") > updates.findIndex((u) => u.files.status === "done"));
    assert.equal(files.kept, 1);
  });

  it("skips what is already stored", async () => {
    const model = fakeModel({ cached: true });
    const final = await makeOfflineSetup({ files: fakeFiles(30, 30), model }).prepare(() => {});
    assert.equal(overallStatus(final), "ready");
    assert.equal(model.loads, 0);
  });

  it("finishes the files even when the guide can't run on this browser", async () => {
    const model = fakeModel({ support: { ok: false, reason: "No WebGPU." } });
    const final = await makeOfflineSetup({ files: fakeFiles(0, 30), model }).prepare(() => {});
    assert.equal(final.files.status, "done");
    assert.equal(final.guide.status, "unsupported");
    assert.equal(final.guide.detail, "No WebGPU.");
    assert.equal(model.loads, 0);
  });

  it("marks failures so the user can try again, and logs why", async () => {
    const logged: string[] = [];
    const final = await makeOfflineSetup({
      files: fakeFiles(0, 30, { fail: true }),
      model: fakeModel({ failLoad: true }),
      logError: (context, e) => logged.push(`${context}: ${(e as Error).message}`),
    }).prepare(() => {});
    assert.equal(final.files.status, "failed");
    assert.equal(final.guide.status, "failed");
    assert.equal(overallStatus(final), "off");
    assert.deepEqual(logged, ["Saving app files failed: offline", "Downloading the Gemma guide failed: network"]);
  });

  it("reports a full phone as no-space, not a generic failure", async () => {
    const quota = new DOMException("Quota exceeded.", "QuotaExceededError");
    const final = await makeOfflineSetup({ files: fakeFiles(30, 30), model: fakeModel({ failLoad: quota }), logError: () => {} }).prepare(() => {});
    assert.equal(final.guide.status, "no-space");
  });

  it("ignores progress that arrives after the download failed", async () => {
    const updates: OfflineReport[] = [];
    const model = fakeModel({ failLoad: true, progressAfterFailure: true });
    const final = await makeOfflineSetup({ files: fakeFiles(30, 30), model, logError: () => {} }).prepare((r) => updates.push(r));
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(final.guide.status, "failed");
    assert.equal(updates.at(-1)?.guide.status, "failed", "no 'working' update after the failure");
  });
});

describe("isNoSpaceError", () => {
  it("spots the browser's quota error, even wrapped", () => {
    assert.ok(isNoSpaceError(new DOMException("Quota exceeded.", "QuotaExceededError")));
    assert.ok(isNoSpaceError(new Error("Failed to cache shard", { cause: new DOMException("x", "QuotaExceededError") })));
    assert.ok(isNoSpaceError(new Error("Storage quota has been exceeded")));
    assert.ok(!isNoSpaceError(new TypeError("Failed to fetch")));
    assert.ok(!isNoSpaceError(undefined));
  });
});

describe("shortProgressText", () => {
  it("drops WebLLM's elapsed time and advice", () => {
    assert.equal(
      shortProgressText(
        "Fetching param cache[26/42]: 720MB fetched. 51% completed, 49 secs elapsed. It can take a while when we first visit this page to populate the cache.",
      ),
      "Fetching param cache[26/42]: 720MB fetched. 51% completed",
    );
    assert.equal(shortProgressText("Start to fetch params"), "Start to fetch params");
  });
});
