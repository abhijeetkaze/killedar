import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lookupMinutes, parsePredictionTable, PredictionTableError } from "../src/domain/predictions.ts";
import { sampleTable } from "./fixtures.ts";

const climb = { distanceKm: 3, elevationGainM: 600, startHour: 7, groupSize: 2 };

describe("parsePredictionTable", () => {
  it("accepts the precompute script's output", () => {
    const t = parsePredictionTable(sampleTable());
    assert.equal(t.hikes, 25);
    assert.deepEqual(t.startHours, [6, 8]);
    assert.equal(t.trails.length, 2);
  });

  it("rejects tables that don't match their own grid", () => {
    const bad = (patch: Record<string, unknown>) => () => parsePredictionTable({ ...(sampleTable() as object), ...patch });
    assert.throws(bad({ model: "naismith" }), PredictionTableError);
    assert.throws(bad({ startHours: [8, 6] }), /startHours/);
    assert.throws(bad({ groupSizes: [1, 3] }), /Malformed/);
    assert.throws(bad({ hikes: 0 }), /hikes/);
    assert.throws(bad({ trails: [{ distanceKm: 3, elevationGainM: 600, minutes: [[1, 2], [3, -4], [5, 6]] }] }), /Malformed/);
    assert.throws(() => parsePredictionTable(null), PredictionTableError);
  });
});

describe("lookupMinutes", () => {
  const table = parsePredictionTable(sampleTable());

  it("finds the cell for the trail, start hour and group size", () => {
    assert.equal(lookupMinutes(table, climb), 172);
    assert.equal(lookupMinutes(table, { ...climb, startHour: 6, groupSize: 1 }), 161);
    assert.equal(lookupMinutes(table, { ...climb, distanceKm: 2.7, startHour: 8 }), 6);
  });

  it("returns null outside the table", () => {
    assert.equal(lookupMinutes(table, { ...climb, distanceKm: 4 }), null);
    assert.equal(lookupMinutes(table, { ...climb, startHour: 5 }), null);
    assert.equal(lookupMinutes(table, { ...climb, startHour: 9 }), null);
    assert.equal(lookupMinutes(table, { ...climb, groupSize: 3 }), null);
    assert.equal(lookupMinutes(table, { ...climb, groupSize: 0 }), null);
  });
});
