import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  descentMinutes,
  formatClock,
  formatDuration,
  naismithMinutes,
  parseClock,
  planDay,
} from "../src/domain/plan.ts";

describe("clock helpers", () => {
  it("parses and formats round-trip", () => {
    for (const t of ["00:00", "06:05", "18:30", "23:59"]) assert.equal(formatClock(parseClock(t)), t);
  });

  it("accepts single-digit hours", () => assert.equal(parseClock("7:15"), 435));

  it("rejects nonsense", () => {
    for (const t of ["", "6pm", "24:00", "12:60", "1230"]) assert.throws(() => parseClock(t), RangeError, t);
  });

  it("formatClock wraps around midnight", () => {
    assert.equal(formatClock(-30), "23:30");
    assert.equal(formatClock(24 * 60 + 5), "00:05");
  });

  it("formats durations", () => {
    assert.equal(formatDuration(45), "45 min");
    assert.equal(formatDuration(120), "2 h");
    assert.equal(formatDuration(135), "2 h 15 min");
    assert.equal(formatDuration(-3), "0 min");
  });
});

describe("naismithMinutes", () => {
  it("is 12 min/km plus 10 min per 100 m of climb", () => {
    assert.equal(naismithMinutes(5, 0), 60);
    assert.equal(naismithMinutes(0, 600), 60);
    assert.equal(naismithMinutes(3, 600), 96);
  });

  it("rejects negatives", () => assert.throws(() => naismithMinutes(-1, 0), RangeError));
});

describe("planDay", () => {
  const base = { lastDeparture: parseClock("18:00"), travelFromPuneMin: 60, climbMin: 100, summitMin: 60, bufferMin: 30 };

  it("works backwards from the last departure", () => {
    const day = planDay(base);
    assert.ok(day);
    const descent = descentMinutes(100); // 70
    assert.equal(day.backAtBaseBy, parseClock("17:30"));
    assert.equal(day.startDescentBy, parseClock("17:30") - descent);
    assert.equal(day.reachTopBy, day.startDescentBy - 60);
    assert.equal(day.startClimbBy, day.reachTopBy - 100);
    assert.equal(day.leavePuneBy, day.startClimbBy - 60);
    assert.equal(formatClock(day.leavePuneBy), "12:40");
    assert.equal(day.totalMin, base.lastDeparture - day.leavePuneBy);
  });

  it("returns null when the day cannot fit", () => {
    assert.equal(planDay({ ...base, lastDeparture: parseClock("03:00") }), null);
  });

  it("rejects invalid inputs", () => {
    assert.throws(() => planDay({ ...base, climbMin: Number.NaN }), /climbMin/);
    assert.throws(() => planDay({ ...base, bufferMin: -1 }), /bufferMin/);
  });
});
