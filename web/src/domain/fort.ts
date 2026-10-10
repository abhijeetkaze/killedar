// Fort model + validation. Pure: no I/O.

export type Lang = "en" | "mr";
export type Difficulty = "easy" | "moderate" | "hard";

export interface Trail {
  name: string;
  startPoint: string;
  /** One-way distance from trailhead to summit. */
  distanceKm: number;
  /** Ascent from trailhead to summit. */
  elevationGainM: number;
  difficulty: Difficulty;
  note: string;
}

export interface Landmark {
  name: string;
  note: string;
}

export interface ReturnTransport {
  note: string;
  /** "HH:MM" last bus/train from the base back towards Pune, or null if unknown. */
  lastDepartureFromBase: string | null;
}

export interface Fort {
  id: string;
  name: string;
  nameMr: string;
  summitElevationM: number;
  /** Approximate one-way travel time from Pune (Swargate) to the trailhead. */
  travelFromPuneMin: number;
  trails: Trail[];
  water: string[];
  landmarks: Landmark[];
  safety: string[];
  returnTransport: ReturnTransport;
  history: Record<Lang, string[]>;
  sources: string[];
  /** False until checked on site or against a cited source. */
  verified: boolean;
}

export interface FortSummary {
  id: string;
  name: string;
  nameMr: string;
}

export class FortValidationError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid fort data: ${problems.join("; ")}`);
    this.name = "FortValidationError";
    this.problems = problems;
  }
}

const DIFFICULTIES: readonly Difficulty[] = ["easy", "moderate", "hard"];
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

type Obj = Record<string, unknown>;

/** Validates untrusted JSON into a Fort, collecting every problem rather than failing on the first. */
export function parseFort(raw: unknown): Fort {
  const problems: string[] = [];
  const r = new Reader(problems);
  const o = r.obj(raw, "fort");

  const fort: Fort = {
    id: r.slug(o.id, "id"),
    name: r.str(o.name, "name"),
    nameMr: r.str(o.nameMr, "nameMr"),
    summitElevationM: r.num(o.summitElevationM, "summitElevationM", 0, 9000),
    travelFromPuneMin: r.num(o.travelFromPuneMin, "travelFromPuneMin", 0, 24 * 60),
    trails: r.list(o.trails, "trails", (t, p) => {
      const to = r.obj(t, p);
      const difficulty = r.str(to.difficulty, `${p}.difficulty`);
      if (difficulty && !DIFFICULTIES.includes(difficulty as Difficulty)) {
        problems.push(`${p}.difficulty must be one of ${DIFFICULTIES.join(", ")}`);
      }
      return {
        name: r.str(to.name, `${p}.name`),
        startPoint: r.str(to.startPoint, `${p}.startPoint`),
        distanceKm: r.num(to.distanceKm, `${p}.distanceKm`, 0.1, 50),
        elevationGainM: r.num(to.elevationGainM, `${p}.elevationGainM`, 0, 3000),
        difficulty: difficulty as Difficulty,
        note: r.str(to.note, `${p}.note`),
      };
    }),
    water: r.list(o.water, "water", (w, p) => r.str(w, p)),
    landmarks: r.list(o.landmarks, "landmarks", (l, p) => {
      const lo = r.obj(l, p);
      return { name: r.str(lo.name, `${p}.name`), note: r.str(lo.note, `${p}.note`) };
    }),
    safety: r.list(o.safety, "safety", (s, p) => r.str(s, p)),
    returnTransport: (() => {
      const rt = r.obj(o.returnTransport, "returnTransport");
      const last = rt.lastDepartureFromBase;
      if (last !== null && (typeof last !== "string" || !CLOCK.test(last))) {
        problems.push(`returnTransport.lastDepartureFromBase must be "HH:MM" or null`);
      }
      return {
        note: r.str(rt.note, "returnTransport.note"),
        lastDepartureFromBase: typeof last === "string" ? last : null,
      };
    })(),
    history: (() => {
      const h = r.obj(o.history, "history");
      return {
        en: r.list(h.en, "history.en", (s, p) => r.str(s, p)),
        mr: r.list(h.mr, "history.mr", (s, p) => r.str(s, p), 0),
      };
    })(),
    sources: r.list(o.sources, "sources", (s, p) => r.str(s, p)),
    verified: r.bool(o.verified, "verified"),
  };

  if (problems.length > 0) throw new FortValidationError(problems);
  return fort;
}

export function summarize(fort: Fort): FortSummary {
  return { id: fort.id, name: fort.name, nameMr: fort.nameMr };
}

/** Small accumulating reader so parseFort stays declarative. */
class Reader {
  private readonly problems: string[];
  constructor(problems: string[]) {
    this.problems = problems;
  }

  obj(v: unknown, path: string): Obj {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Obj;
    this.problems.push(`${path} must be an object`);
    return {};
  }

  str(v: unknown, path: string): string {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    this.problems.push(`${path} must be a non-empty string`);
    return "";
  }

  slug(v: unknown, path: string): string {
    const s = this.str(v, path);
    if (s && !/^[a-z0-9-]+$/.test(s)) this.problems.push(`${path} must be lowercase a-z, 0-9, -`);
    return s;
  }

  num(v: unknown, path: string, min: number, max: number): number {
    if (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max) return v;
    this.problems.push(`${path} must be a number between ${min} and ${max}`);
    return 0;
  }

  bool(v: unknown, path: string): boolean {
    if (typeof v === "boolean") return v;
    this.problems.push(`${path} must be true or false`);
    return false;
  }

  list<T>(v: unknown, path: string, item: (x: unknown, p: string) => T, minItems = 1): T[] {
    if (!Array.isArray(v)) {
      this.problems.push(`${path} must be a list`);
      return [];
    }
    if (v.length < minItems) this.problems.push(`${path} needs at least ${minItems} item(s)`);
    return v.map((x, i) => item(x, `${path}[${i}]`));
  }
}
