// Chooses which on-device Gemma build to run. Pure, so the choice is testable
// without loading WebLLM.

/** Mid-range phones run ~2B comfortably; 4B+ builds need 3 GB+ of GPU memory. */
export const MAX_PARAMS_B = 2.6;

export interface ModelChoice {
  id: string;
  paramsB: number;
  generation: number;
}

/** "gemma-2-2b-it-q4f16_1-MLC" → { generation: 2, paramsB: 2 }. Null if not a Gemma instruct build. */
export function describeGemma(id: string): ModelChoice | null {
  const m = /^gemma-?(\d+(?:\.\d+)?)?-(\d+(?:\.\d+)?)b-it-/i.exec(id);
  if (!m || !m[2]) return null;
  return { id, generation: m[1] ? Number(m[1]) : 1, paramsB: Number(m[2]) };
}

export interface PickOptions {
  /** GPU supports the `shader-f16` feature. Without it, f16 builds won't run. */
  supportsF16: boolean;
}

/**
 * Picks the best Gemma for a phone: newest generation, then the largest that fits under
 * MAX_PARAMS_B, preferring q4f16 (half the memory of q4f32), then the full context window
 * over WebLLM's "-1k" builds (fort facts + chat history overflow 1024 tokens). Null if none fit.
 */
export function pickGemmaModel(availableIds: readonly string[], opts: PickOptions = { supportsF16: true }): string | null {
  const candidates = availableIds
    .map(describeGemma)
    .filter((c): c is ModelChoice => c !== null && c.paramsB <= MAX_PARAMS_B)
    .filter((c) => opts.supportsF16 || !/f16/i.test(c.id));
  if (candidates.length === 0) return null;
  const score = (c: ModelChoice): [number, number, number, number] => [
    c.generation,
    c.paramsB,
    /q4f16/i.test(c.id) ? 1 : 0,
    /-1k$/i.test(c.id) ? 0 : 1,
  ];
  candidates.sort((a, b) => {
    const [ga, pa, qa, ka] = score(a);
    const [gb, pb, qb, kb] = score(b);
    return gb - ga || pb - pa || qb - qa || kb - ka;
  });
  return candidates[0]?.id ?? null;
}
