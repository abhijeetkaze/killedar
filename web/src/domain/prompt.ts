// Builds the grounded prompt for the on-device model. Pure.

import type { Fort, Lang } from "./fort.ts";
import type { ChatMessage } from "./chat.ts";

export const MAX_QUESTION_CHARS = 500;

export class EmptyQuestionError extends Error {
  constructor() {
    super("Ask a question first.");
    this.name = "EmptyQuestionError";
  }
}

/** Compact plain-text notes: small models follow prose better than raw JSON, and it saves context. */
export function renderFortNotes(fort: Fort): string {
  const lines: string[] = [
    `FORT: ${fort.name} (${fort.nameMr}), summit about ${fort.summitElevationM} m.`,
    `From Pune: about ${fort.travelFromPuneMin} min to the trailhead.`,
    "TRAILS:",
    ...fort.trails.map(
      (t) =>
        `- ${t.name} from ${t.startPoint}: ~${t.distanceKm} km, ~${t.elevationGainM} m climb, ${t.difficulty}. ${t.note}`,
    ),
    "LANDMARKS:",
    ...fort.landmarks.map((l) => `- ${l.name}: ${l.note}`),
    "WATER:",
    ...fort.water.map((w) => `- ${w}`),
    "SAFETY:",
    ...fort.safety.map((s) => `- ${s}`),
    `GETTING BACK: ${fort.returnTransport.note}`,
    "HISTORY:",
    ...fort.history.en.map((h) => `- ${h}`),
  ];
  return lines.join("\n");
}

export function systemInstruction(fort: Fort, lang: Lang): string {
  const language =
    lang === "mr"
      ? "Answer in simple Marathi using Devanagari script."
      : "Answer in simple English.";
  return [
    `You are Killedar, a trek companion for ${fort.name}.`,
    "Answer only from the FORT NOTES. If the notes do not cover it, say so and give general Sahyadri safety advice.",
    "Never invent bus times, distances or phone numbers.",
    "Keep answers under 80 words — the user is walking.",
    language,
  ].join(" ");
}

/**
 * Gemma's chat template has no system role, so everything goes in one user turn.
 * Works for every model, so we don't special-case.
 */
export function buildAskMessages(fort: Fort, question: string, lang: Lang): ChatMessage[] {
  const q = question.trim().slice(0, MAX_QUESTION_CHARS);
  if (q.length === 0) throw new EmptyQuestionError();
  const content = [
    systemInstruction(fort, lang),
    "",
    "FORT NOTES:",
    renderFortNotes(fort),
    "",
    `QUESTION: ${q}`,
  ].join("\n");
  return [{ role: "user", content }];
}
