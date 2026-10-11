// Use case: "When do I need to leave Pune to climb this fort and make the last bus back?"

import type { Fort, Trail } from "../domain/fort.ts";
import { naismithMinutes, parseClock, planDay, type DayPlan } from "../domain/plan.ts";
import type { ClimbEstimate, ClimbInput, ClimbPredictor } from "../ports/climbPredictor.ts";
import type { FortRepository } from "../ports/fortRepository.ts";

export interface PlanRequest {
  fortId: string;
  trailIndex: number;
  startHour: number;
  groupSize: number;
  summitMin: number;
  bufferMin: number;
  /** "HH:MM" the user typed, overriding the fort data. */
  lastDepartureOverride?: string;
}

export type PlanWarning = "offline-estimate" | "unknown-last-departure" | "does-not-fit" | "unverified-data";

export interface TrekPlan {
  fort: Fort;
  trail: Trail;
  estimate: ClimbEstimate;
  day: DayPlan | null;
  warnings: PlanWarning[];
}

export interface PlanTrekDeps {
  forts: FortRepository;
  predictor: ClimbPredictor;
}

export function makePlanTrek({ forts, predictor }: PlanTrekDeps) {
  return async function planTrek(req: PlanRequest): Promise<TrekPlan> {
    const fort = await forts.get(req.fortId);
    const trail = fort.trails[req.trailIndex];
    if (!trail) throw new RangeError(`${fort.name} has no trail #${req.trailIndex}`);

    const warnings: PlanWarning[] = [];
    if (!fort.verified) warnings.push("unverified-data");

    const input: ClimbInput = {
      distanceKm: trail.distanceKm,
      elevationGainM: trail.elevationGainM,
      startHour: req.startHour,
      groupSize: req.groupSize,
    };
    const estimate = await estimateOrFallback(predictor, input, warnings);

    const lastDeparture = req.lastDepartureOverride?.trim() || fort.returnTransport.lastDepartureFromBase;
    let day: DayPlan | null = null;
    if (!lastDeparture) {
      warnings.push("unknown-last-departure");
    } else {
      day = planDay({
        lastDeparture: parseClock(lastDeparture),
        travelFromPuneMin: fort.travelFromPuneMin,
        climbMin: estimate.minutes,
        summitMin: req.summitMin,
        bufferMin: req.bufferMin,
      });
      if (!day) warnings.push("does-not-fit");
    }

    return { fort, trail, estimate, day, warnings };
  };
}

/** The prediction service is online-only; on the trail we fall back to the rule of thumb. */
async function estimateOrFallback(
  predictor: ClimbPredictor,
  input: ClimbInput,
  warnings: PlanWarning[],
): Promise<ClimbEstimate> {
  try {
    return await predictor.predict(input);
  } catch {
    warnings.push("offline-estimate");
    const minutes = naismithMinutes(input.distanceKm, input.elevationGainM);
    return { minutes, baselineMinutes: minutes, source: "naismith" };
  }
}
