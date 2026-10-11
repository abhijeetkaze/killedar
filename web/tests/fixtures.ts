import type { Fort } from "../src/domain/fort.ts";
import type { ClimbEstimate, ClimbInput, ClimbPredictor } from "../src/ports/climbPredictor.ts";
import { FortNotFoundError, type FortRepository } from "../src/ports/fortRepository.ts";
import type { ChatMessage, LanguageModel, LoadProgress, Support } from "../src/ports/languageModel.ts";

export function sampleFort(overrides: Partial<Fort> = {}): Fort {
  return {
    id: "testgad",
    name: "Testgad",
    nameMr: "टेस्टगड",
    summitElevationM: 1200,
    travelFromPuneMin: 60,
    trails: [
      {
        name: "Main path",
        startPoint: "Base village",
        distanceKm: 3,
        elevationGainM: 600,
        difficulty: "moderate",
        note: "Stone steps most of the way.",
      },
    ],
    water: ["Tank near the top gate — filter before drinking."],
    landmarks: [{ name: "Main Darwaja", note: "Main gate." }],
    safety: ["Start descending well before sunset."],
    returnTransport: { note: "Bus from the base village.", lastDepartureFromBase: "18:00" },
    history: { en: ["Built long ago."], mr: [] },
    sources: ["https://example.org/testgad"],
    verified: false,
    ...overrides,
  };
}

export function memoryForts(...forts: Fort[]): FortRepository {
  return {
    async list() {
      return forts.map((f) => ({ id: f.id, name: f.name, nameMr: f.nameMr }));
    },
    async get(id) {
      const f = forts.find((x) => x.id === id);
      if (!f) throw new FortNotFoundError(id);
      return f;
    },
  };
}

export function fixedPredictor(minutes: number, baselineMinutes = minutes): ClimbPredictor & { calls: ClimbInput[] } {
  const calls: ClimbInput[] = [];
  return {
    calls,
    async predict(input): Promise<ClimbEstimate> {
      calls.push(input);
      return { minutes, baselineMinutes, source: "tabpfn" };
    },
  };
}

export const failingPredictor: ClimbPredictor = {
  async predict() {
    throw new Error("offline");
  },
};

export function scriptedModel(chunks: string[]): LanguageModel & { received: ChatMessage[][] } {
  const received: ChatMessage[][] = [];
  return {
    received,
    modelName: "fake-gemma",
    async checkSupport(): Promise<Support> {
      return { ok: true };
    },
    async isCached() {
      return true;
    },
    async load(onProgress: (p: LoadProgress) => void) {
      onProgress({ fraction: 1, text: "ready" });
    },
    async *stream(messages) {
      received.push(messages);
      yield* chunks;
    },
  };
}

export async function collect(it: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const c of it) out += c;
  return out;
}

/** Minimal Response stand-in for fetch fakes. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
