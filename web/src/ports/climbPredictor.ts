export interface ClimbInput {
  distanceKm: number;
  elevationGainM: number;
  /** Hour of day the climb starts, 0..23. */
  startHour: number;
  groupSize: number;
}

export type EstimateSource = "tabpfn" | "naismith";

export interface ClimbEstimate {
  /** Predicted ascent time, trailhead → summit. */
  minutes: number;
  /** Naismith's rule for the same trail, for comparison. */
  baselineMinutes: number;
  source: EstimateSource;
}

/** Predicts how long *this* hiker takes to climb a trail. */
export interface ClimbPredictor {
  predict(input: ClimbInput): Promise<ClimbEstimate>;
}
