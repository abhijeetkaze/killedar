// Build: tsc → dist/js, copy static files, generate audio index + service worker.
// Usage: KILLEDAR_API_URL=https://killedar-api.onrender.com node scripts/build.ts

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { audioIndex, buildVersion, injectApiUrl, precacheList, renderServiceWorker } from "./precache.ts";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const tsc = join(root, "node_modules", ".bin", "tsc");

rmSync(dist, { recursive: true, force: true });
execFileSync(tsc, ["-p", join(root, "tsconfig.build.json")], { stdio: "inherit" });

cpSync(join(root, "public"), dist, { recursive: true });
writeFileSync(
  join(dist, "index.html"),
  injectApiUrl(readFileSync(join(root, "index.html"), "utf8"), process.env.KILLEDAR_API_URL?.trim() ?? ""),
);

const audioDir = join(dist, "audio");
const audio = existsSync(audioDir) ? audioIndex(readdirSync(audioDir)) : [];
writeFileSync(join(audioDir, "index.json"), JSON.stringify(audio));

const files = walk(dist).map((f) => relative(dist, f));
const precache = precacheList(files);
const version = buildVersion(precache.filter((u) => u !== "./").map((u) => readFileSync(join(dist, u))));
writeFileSync(join(dist, "sw.js"), renderServiceWorker(readFileSync(join(root, "scripts", "sw.template.js"), "utf8"), version, precache));

console.log(`Built dist/ — ${precache.length} precached files, ${audio.length} audio, sw ${version}`);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}
