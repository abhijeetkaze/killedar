import { naismithMinutes } from "../domain/plan.ts";
import type { ClimbEstimate, ClimbInput, ClimbPredictor } from "../ports/climbPredictor.ts";

/** Offline predictor: Naismith's rule only. Used when no prediction service is configured. */
export const naismithPredictor: ClimbPredictor = {
  async predict({ distanceKm, elevationGainM }: ClimbInput): Promise<ClimbEstimate> {
    const minutes = naismithMinutes(distanceKm, elevationGainM);
    return { minutes, baselineMinutes: minutes, source: "naismith" };
  },
};
