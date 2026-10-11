import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FortValidationError, parseFort, summarize } from "../src/domain/fort.ts";
import { sampleFort } from "./fixtures.ts";

describe("parseFort", () => {
  it("accepts a valid fort and trims strings", () => {
    const raw = { ...sampleFort(), name: "  Testgad  " };
    const fort = parseFort(JSON.parse(JSON.stringify(raw)));
    assert.equal(fort.name, "Testgad");
    assert.equal(fort.trails[0]?.distanceKm, 3);
  });

  it("allows an unknown last departure (null)", () => {
    const fort = parseFort({ ...sampleFort(), returnTransport: { note: "Ask locally.", lastDepartureFromBase: null } });
    assert.equal(fort.returnTransport.lastDepartureFromBase, null);
  });

  it("collects every problem instead of stopping at the first", () => {
    const bad = {
      ...sampleFort(),
      id: "Not A Slug",
      summitElevationM: -5,
      trails: [{ ...sampleFort().trails[0], difficulty: "extreme" }],
      returnTransport: { note: "x", lastDepartureFromBase: "6pm" },
    };
    assert.throws(
      () => parseFort(bad),
      (e: unknown) => {
        assert.ok(e instanceof FortValidationError);
        assert.equal(e.problems.length, 4, e.problems.join("\n"));
        assert.ok(e.problems.some((p) => p.startsWith("id")));
        assert.ok(e.problems.some((p) => p.includes("summitElevationM")));
        assert.ok(e.problems.some((p) => p.includes("difficulty")));
        assert.ok(e.problems.some((p) => p.includes("lastDepartureFromBase")));
        return true;
      },
    );
  });

  it("rejects non-objects and empty required lists", () => {
    assert.throws(() => parseFort(null), FortValidationError);
    assert.throws(() => parseFort({ ...sampleFort(), trails: [] }), /trails needs at least 1/);
  });

  it("Marathi history may be empty but English may not", () => {
    assert.doesNotThrow(() => parseFort({ ...sampleFort(), history: { en: ["x"], mr: [] } }));
    assert.throws(() => parseFort({ ...sampleFort(), history: { en: [], mr: ["x"] } }), /history\.en/);
  });

  it("summarize keeps only list fields", () => {
    assert.deepEqual(summarize(sampleFort()), { id: "testgad", name: "Testgad", nameMr: "टेस्टगड" });
  });
});
