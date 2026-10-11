import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { narrationJobs } from "../scripts/narration.ts";
import { audioIndex } from "../scripts/precache.ts";
import { sampleFort } from "./fixtures.ts";

describe("narrationJobs", () => {
  it("narrates each language that has history, titled in that language", () => {
    const jobs = narrationJobs(sampleFort({ history: { en: ["Built long ago."], mr: ["खूप जुना."] } }));
    assert.deepEqual(jobs, [
      { file: "testgad-en.mp3", lang: "en", text: "Testgad. Built long ago." },
      { file: "testgad-mr.mp3", lang: "mr", text: "टेस्टगड. खूप जुना." },
    ]);
  });

  it("skips languages without text", () => {
    assert.deepEqual(narrationJobs(sampleFort()).map((j) => j.lang), ["en"]);
  });

  it("produces file names the build will publish", () => {
    const files = narrationJobs(sampleFort({ history: { en: ["a"], mr: ["b"] } })).map((j) => j.file);
    assert.deepEqual(audioIndex(files), files);
  });
});
