// Calls the Killedar API (api/), which runs TabPFN on the hiker's own past hikes.

import type { ClimbEstimate, ClimbInput, ClimbPredictor, EstimateSource } from "../ports/climbPredictor.ts";
import { defaultFetch, type FetchLike } from "./http.ts";

export interface HttpClimbPredictorOptions {
  baseUrl: string;
  fetch?: FetchLike;
  /** Render's free tier sleeps; first call can take ~30 s. */
  timeoutMs?: number;
}

export class PredictionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionError";
  }
}

const SOURCES: readonly EstimateSource[] = ["tabpfn", "naismith"];

export function httpClimbPredictor(opts: HttpClimbPredictorOptions): ClimbPredictor {
  const doFetch = opts.fetch ?? defaultFetch;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const url = `${opts.baseUrl.replace(/\/+$/, "")}/predict`;

  return {
    async predict(input: ClimbInput): Promise<ClimbEstimate> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            distance_km: input.distanceKm,
            elevation_gain_m: input.elevationGainM,
            start_hour: input.startHour,
            group_size: input.groupSize,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new PredictionError(`Prediction service answered ${res.status}`);
        return parseEstimate(await res.json());
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function parseEstimate(body: unknown): ClimbEstimate {
  if (typeof body !== "object" || body === null) throw new PredictionError("Malformed response");
  const b = body as Record<string, unknown>;
  const minutes = b.minutes;
  const baseline = b.baseline_minutes;
  const source = b.model;
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    minutes <= 0 ||
    typeof baseline !== "number" ||
    !SOURCES.includes(source as EstimateSource)
  ) {
    throw new PredictionError("Malformed response");
  }
  return { minutes: Math.round(minutes), baselineMinutes: Math.round(baseline), source: source as EstimateSource };
}
