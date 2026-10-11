// Climb times TabPFN predicted ahead of time (api/killedar_api/precompute.py) for every trail,
// start hour and group size the Plan screen offers. Shipped as predictions.json, so it works offline.

export interface PredictionTable {
  /** Hikes TabPFN learned from. */
  hikes: number;
  /** Inclusive [first, last] start hour of the grid. */
  startHours: [number, number];
  /** Inclusive [smallest, largest] group size of the grid. */
  groupSizes: [number, number];
  trails: TrailPredictions[];
}

export interface TrailPredictions {
  distanceKm: number;
  elevationGainM: number;
  /** minutes[startHour - startHours[0]][groupSize - groupSizes[0]] */
  minutes: number[][];
}

export class PredictionTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionTableError";
  }
}

export function parsePredictionTable(raw: unknown): PredictionTable {
  const o = raw as Record<string, unknown> | null;
  if (typeof o !== "object" || o === null || o.model !== "tabpfn") throw new PredictionTableError("Not a TabPFN table");
  const startHours = range(o.startHours, "startHours");
  const groupSizes = range(o.groupSizes, "groupSizes");
  if (!isCount(o.hikes) || !Array.isArray(o.trails)) throw new PredictionTableError("Missing hikes or trails");
  const rows = startHours[1] - startHours[0] + 1;
  const cols = groupSizes[1] - groupSizes[0] + 1;
  const trails = o.trails.map((t: unknown): TrailPredictions => {
    const r = t as Record<string, unknown> | null;
    if (
      typeof r !== "object" ||
      r === null ||
      !isPositive(r.distanceKm) ||
      typeof r.elevationGainM !== "number" ||
      !Array.isArray(r.minutes) ||
      r.minutes.length !== rows ||
      !r.minutes.every((row: unknown) => Array.isArray(row) && row.length === cols && row.every(isPositive))
    ) {
      throw new PredictionTableError("Malformed trail row");
    }
    return { distanceKm: r.distanceKm, elevationGainM: r.elevationGainM, minutes: r.minutes as number[][] };
  });
  return { hikes: o.hikes, startHours, groupSizes, trails };
}

/** Predicted minutes for this climb, or null when the trail or the hour/group is outside the table. */
export function lookupMinutes(
  table: PredictionTable,
  climb: { distanceKm: number; elevationGainM: number; startHour: number; groupSize: number },
): number | null {
  const trail = table.trails.find((t) => t.distanceKm === climb.distanceKm && t.elevationGainM === climb.elevationGainM);
  return trail?.minutes[climb.startHour - table.startHours[0]]?.[climb.groupSize - table.groupSizes[0]] ?? null;
}

function range(v: unknown, name: string): [number, number] {
  if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isInteger) || v[0] > v[1]) {
    throw new PredictionTableError(`Bad ${name}`);
  }
  return [v[0], v[1]];
}

const isPositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
