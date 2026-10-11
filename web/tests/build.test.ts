import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { audioIndex, buildVersion, injectApiUrl, precacheList, renderServiceWorker } from "../scripts/precache.ts";

describe("precacheList", () => {
  it("includes the start URL and shipped files, sorted, without maps or the worker itself", () => {
    assert.deepEqual(precacheList(["js/main.js", "js/main.js.map", "index.html", "sw.js", "forts/a.json", "audio/.gitkeep"]), [
      "./",
      "./forts/a.json",
      "./index.html",
      "./js/main.js",
    ]);
  });
});

describe("buildVersion", () => {
  it("changes when content changes", () => {
    assert.equal(buildVersion(["a", "b"]), buildVersion(["a", "b"]));
    assert.notEqual(buildVersion(["a", "b"]), buildVersion(["a", "c"]));
    assert.equal(buildVersion(["x"]).length, 12);
  });
});

describe("renderServiceWorker", () => {
  const template = readFileSync(join(import.meta.dirname, "..", "scripts", "sw.template.js"), "utf8");

  it("fills both placeholders in the real template", () => {
    const sw = renderServiceWorker(template, "abc123", ["./", "./index.html"]);
    assert.match(sw, /const VERSION = "abc123";/);
    assert.match(sw, /"\.\/index\.html"/);
    assert.doesNotMatch(sw, /__PRECACHE__|__VERSION__/);
  });

  it("refuses a template without placeholders", () => {
    assert.throws(() => renderServiceWorker("nothing", "v", []), /placeholder/);
  });
});

describe("audioIndex", () => {
  it("keeps only fort-language mp3s", () => {
    assert.deepEqual(audioIndex(["rajgad-mr.mp3", "notes.txt", "sinhagad-en.mp3", "x-hi.mp3", ".gitkeep"]), [
      "rajgad-mr.mp3",
      "sinhagad-en.mp3",
    ]);
  });
});

describe("injectApiUrl", () => {
  const html = '<meta name="killedar-api" content="%KILLEDAR_API_URL%" />';
  it("injects https URLs and allows empty", () => {
    assert.match(injectApiUrl(html, "https://api.example.com"), /content="https:\/\/api\.example\.com"/);
    assert.match(injectApiUrl(html, ""), /content=""/);
    assert.match(injectApiUrl(html, "http://localhost:8000"), /localhost:8000/);
  });
  it("rejects anything that could break out of the attribute", () => {
    assert.throws(() => injectApiUrl(html, 'https://x" onload="alert(1)'), /KILLEDAR_API_URL/);
    assert.throws(() => injectApiUrl(html, "http://api.example.com"), /https/);
  });
});
