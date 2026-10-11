// Pure helpers for the build: which files the service worker precaches, and its source.

import { createHash } from "node:crypto";

const EXCLUDE = [/\.map$/, /^sw\.js$/, /(^|\/)\.gitkeep$/];

/** Relative dist paths → sorted precache URLs, always including the start URL. */
export function precacheList(files: readonly string[]): string[] {
  const urls = files
    .map((f) => f.replaceAll("\\", "/"))
    .filter((f) => !EXCLUDE.some((re) => re.test(f)))
    .map((f) => `./${f}`)
    .sort();
  return ["./", ...urls];
}

/** Content hash of the shipped files, so every deploy installs a fresh service worker. */
export function buildVersion(contents: readonly (string | Uint8Array)[]): string {
  const hash = createHash("sha256");
  for (const c of contents) hash.update(c);
  return hash.digest("hex").slice(0, 12);
}

export function renderServiceWorker(template: string, version: string, precache: readonly string[]): string {
  if (!template.includes("__VERSION__") || !template.includes("__PRECACHE__")) {
    throw new Error("Service worker template is missing a placeholder");
  }
  return template.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(precache, null, 2));
}

/** Audio files present at build time, published as audio/index.json for the Listen screen. */
export function audioIndex(files: readonly string[]): string[] {
  return files.filter((f) => /^[a-z0-9-]+-(en|mr)\.mp3$/.test(f)).sort();
}
