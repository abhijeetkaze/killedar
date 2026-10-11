// Reads TabPFN's precomputed climb times (predictions.json, precached by the service worker).
// Anything the table can't answer — missing file, new trail, odd hour — gets Naismith's rule.

import { naismithMinutes } from "../domain/plan.ts";
import { lookupMinutes, parsePredictionTable, type PredictionTable } from "../domain/predictions.ts";
import type { ClimbEstimate, ClimbInput, ClimbPredictor } from "../ports/climbPredictor.ts";
import { defaultFetch, type FetchLike } from "./http.ts";

export function tablePredictor(url: string, doFetch: FetchLike = defaultFetch): ClimbPredictor {
  let table: Promise<PredictionTable | null> | null = null;
  const load = () =>
    (table ??= doFetch(url)
      .then(async (res) => (res.ok ? parsePredictionTable(await res.json()) : null))
      .catch((e: unknown) => {
        console.warn("[Killedar] No climb-time predictions; using the rule of thumb", e);
        return null;
      })
      .then((t) => {
        if (!t) table = null; // try again next time
        return t;
      }));

  return {
    async predict(input: ClimbInput): Promise<ClimbEstimate> {
      const baselineMinutes = naismithMinutes(input.distanceKm, input.elevationGainM);
      const t = await load();
      const minutes = t && lookupMinutes(t, input);
      return minutes
        ? { minutes, baselineMinutes, source: "tabpfn" }
        : { minutes: baselineMinutes, baselineMinutes, source: "naismith" };
    },
  };
}
