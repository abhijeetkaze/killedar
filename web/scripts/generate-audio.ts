// Generates fort-history narration with ElevenLabs, once, at build time.
// The MP3s ship with the app and are precached, so they play on the fort with no signal.
//
//   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npm run audio [-- --force]
//   optional: ELEVENLABS_MODEL (default eleven_v3 — eleven_multilingual_v2 rejects Marathi)
//
// Without a *-mr.mp3 file the app falls back to the phone's own text-to-speech for Marathi.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseFort } from "../src/domain/fort.ts";
import { narrationJobs } from "./narration.ts";

const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID;
const model = process.env.ELEVENLABS_MODEL ?? "eleven_v3";
const force = process.argv.includes("--force");

if (!key || !voice) {
  console.error("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID.");
  process.exit(1);
}

const fortsDir = join(import.meta.dirname, "..", "public", "forts");
const audioDir = join(import.meta.dirname, "..", "public", "audio");

for (const file of readdirSync(fortsDir).filter((f) => f.endsWith(".json") && f !== "index.json")) {
  const fort = parseFort(JSON.parse(readFileSync(join(fortsDir, file), "utf8")));
  for (const job of narrationJobs(fort)) {
    const out = join(audioDir, job.file);
    if (existsSync(out) && !force) {
      console.log(`skip ${job.file} (exists)`);
      continue;
    }
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text: job.text, model_id: model, language_code: job.lang }),
    });
    if (!res.ok) {
      console.error(`fail ${job.file}: ${res.status} ${await res.text()}`);
      process.exitCode = 1;
      continue;
    }
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(`wrote ${job.file}`);
  }
}
