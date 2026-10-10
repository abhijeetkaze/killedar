import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makePlanTrek, type PlanRequest } from "../src/app/planTrek.ts";
import { formatClock } from "../src/domain/plan.ts";
import { FortNotFoundError } from "../src/ports/fortRepository.ts";
import { failingPredictor, fixedPredictor, memoryForts, sampleFort } from "./fixtures.ts";

const req: PlanRequest = { fortId: "testgad", trailIndex: 0, startHour: 7, groupSize: 2, summitMin: 60, bufferMin: 30 };

describe("planTrek", () => {
  it("sends the trail's features to the predictor and plans backwards from the last bus", async () => {
    const predictor = fixedPredictor(100, 96);
    const plan = await makePlanTrek({ forts: memoryForts(sampleFort()), predictor })(req);
    assert.deepEqual(predictor.calls, [{ distanceKm: 3, elevationGainM: 600, startHour: 7, groupSize: 2 }]);
    assert.equal(plan.estimate.source, "tabpfn");
    assert.ok(plan.day);
    assert.equal(formatClock(plan.day.leavePuneBy), "12:40");
    assert.deepEqual(plan.warnings, ["unverified-data"]);
  });

  it("falls back to Naismith when the predictor is unreachable", async () => {
    const plan = await makePlanTrek({ forts: memoryForts(sampleFort({ verified: true })), predictor: failingPredictor })(req);
    assert.deepEqual(plan.estimate, { minutes: 96, baselineMinutes: 96, source: "naismith" });
    assert.deepEqual(plan.warnings, ["offline-estimate"]);
    assert.ok(plan.day);
  });

  it("uses the user's last-departure override", async () => {
    const plan = await makePlanTrek({ forts: memoryForts(sampleFort()), predictor: fixedPredictor(100) })({
      ...req,
      lastDepartureOverride: "19:00",
    });
    assert.equal(formatClock(plan.day?.leavePuneBy ?? -1), "13:40");
  });

  it("asks for the last departure when the fort data doesn't know it", async () => {
    const fort = sampleFort({ returnTransport: { note: "Ask locally", lastDepartureFromBase: null } });
    const plan = await makePlanTrek({ forts: memoryForts(fort), predictor: fixedPredictor(100) })(req);
    assert.equal(plan.day, null);
    assert.ok(plan.warnings.includes("unknown-last-departure"));
  });

  it("flags plans that do not fit in a day", async () => {
    const plan = await makePlanTrek({ forts: memoryForts(sampleFort()), predictor: fixedPredictor(100) })({
      ...req,
      lastDepartureOverride: "04:00",
    });
    assert.equal(plan.day, null);
    assert.ok(plan.warnings.includes("does-not-fit"));
  });

  it("rejects unknown forts and trails", async () => {
    const planTrek = makePlanTrek({ forts: memoryForts(sampleFort()), predictor: fixedPredictor(100) });
    await assert.rejects(planTrek({ ...req, fortId: "nope" }), FortNotFoundError);
    await assert.rejects(planTrek({ ...req, trailIndex: 5 }), RangeError);
  });
});
