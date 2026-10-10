// What gets narrated for each fort, and where the file goes. Pure, tested.

import type { Fort, Lang } from "../src/domain/fort.ts";

export interface NarrationJob {
  file: string;
  lang: Lang;
  text: string;
}

export function narrationJobs(fort: Fort): NarrationJob[] {
  const jobs: NarrationJob[] = [];
  for (const lang of ["en", "mr"] as const) {
    const lines = fort.history[lang];
    if (lines.length === 0) continue;
    const title = lang === "mr" ? fort.nameMr : fort.name;
    jobs.push({ file: `${fort.id}-${lang}.mp3`, lang, text: [`${title}.`, ...lines].join(" ") });
  }
  return jobs;
}
