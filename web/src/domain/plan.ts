// Trek timing. Pure: times are minutes since midnight, passed in by the caller.

const MINUTES_PER_DAY = 24 * 60;

/** "06:45" → 405. Throws on malformed input. */
export function parseClock(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new RangeError(`Expected HH:MM, got "${hhmm}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new RangeError(`Not a clock time: "${hhmm}"`);
  return h * 60 + min;
}

/** 405 → "06:45". Wraps around midnight. */
export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 135 → "2 h 15 min". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/**
 * Naismith's rule: 1 h per 5 km horizontal + 1 h per 600 m ascent.
 * The rule-of-thumb baseline the learned model is compared against.
 */
export function naismithMinutes(distanceKm: number, elevationGainM: number): number {
  if (distanceKm < 0 || elevationGainM < 0) throw new RangeError("distance and gain must be ≥ 0");
  return Math.round(distanceKm * 12 + elevationGainM / 10);
}

/** Descending on Sahyadri laterite is faster than climbing but not by much: assume 70 %. */
export const DESCENT_FACTOR = 0.7;

export function descentMinutes(climbMinutes: number): number {
  return Math.round(climbMinutes * DESCENT_FACTOR);
}

export interface DayPlanInput {
  /** Last bus/train back from the base, minutes since midnight. */
  lastDeparture: number;
  travelFromPuneMin: number;
  climbMin: number;
  /** Time spent exploring the top. */
  summitMin: number;
  /** Safety margin before the last departure. */
  bufferMin: number;
}

export interface DayPlan {
  leavePuneBy: number;
  startClimbBy: number;
  reachTopBy: number;
  startDescentBy: number;
  backAtBaseBy: number;
  lastDeparture: number;
  totalMin: number;
}

/**
 * Works backwards from the last departure so you never get stuck at the base.
 * Returns null when the day doesn't fit (you'd have to leave before midnight).
 */
export function planDay(input: DayPlanInput): DayPlan | null {
  for (const [k, v] of Object.entries(input)) {
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`${k} must be a non-negative number`);
  }
  const descent = descentMinutes(input.climbMin);
  const backAtBaseBy = input.lastDeparture - input.bufferMin;
  const startDescentBy = backAtBaseBy - descent;
  const reachTopBy = startDescentBy - input.summitMin;
  const startClimbBy = reachTopBy - input.climbMin;
  const leavePuneBy = startClimbBy - input.travelFromPuneMin;
  if (leavePuneBy < 0) return null;
  return {
    leavePuneBy,
    startClimbBy,
    reachTopBy,
    startDescentBy,
    backAtBaseBy,
    lastDeparture: input.lastDeparture,
    totalMin: input.lastDeparture - leavePuneBy,
  };
}
