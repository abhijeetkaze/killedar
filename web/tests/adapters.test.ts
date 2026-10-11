import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchFortRepository } from "../src/adapters/fetchFortRepository.ts";
import { tablePredictor } from "../src/adapters/tablePredictor.ts";
import type { FetchLike } from "../src/adapters/http.ts";
import { FortValidationError } from "../src/domain/fort.ts";
import { FortNotFoundError } from "../src/ports/fortRepository.ts";
import { jsonResponse, sampleFort, sampleTable } from "./fixtures.ts";

const input = { distanceKm: 3, elevationGainM: 600, startHour: 7, groupSize: 2 };

describe("tablePredictor", () => {
  const serving = (body: unknown, status = 200) => {
    const calls: string[] = [];
    const fetch: FetchLike = async (url) => {
      calls.push(url);
      return jsonResponse(body, status);
    };
    return { calls, fetch };
  };

  it("answers from TabPFN's table, with Naismith alongside", async () => {
    const { calls, fetch } = serving(sampleTable());
    const predictor = tablePredictor("./predictions.json", fetch);
    assert.deepEqual(await predictor.predict(input), { minutes: 172, baselineMinutes: 96, source: "tabpfn" });
    await predictor.predict(input);
    assert.deepEqual(calls, ["./predictions.json"], "loads the table once");
  });

  it("uses the rule of thumb outside the table", async () => {
    const predictor = tablePredictor("x", serving(sampleTable()).fetch);
    assert.deepEqual(await predictor.predict({ ...input, startHour: 13 }), { minutes: 96, baselineMinutes: 96, source: "naismith" });
  });

  it("uses the rule of thumb when the table is missing or broken, and retries later", async () => {
    const missing = serving({}, 404);
    const predictor = tablePredictor("x", missing.fetch);
    assert.equal((await predictor.predict(input)).source, "naismith");
    await predictor.predict(input);
    assert.equal(missing.calls.length, 2);
    const broken = tablePredictor("x", serving({ model: "tabpfn" }).fetch);
    assert.equal((await broken.predict(input)).source, "naismith");
    const offline = tablePredictor("x", async () => Promise.reject(new TypeError("Failed to fetch")));
    assert.equal((await offline.predict(input)).source, "naismith");
  });
});

describe("fetchFortRepository", () => {
  const files: Record<string, unknown> = {
    "/forts/index.json": [{ id: "testgad", name: "Testgad", nameMr: "टेस्टगड" }],
    "/forts/testgad.json": sampleFort(),
    "/forts/broken.json": { id: "broken" },
  };
  const counting = () => {
    const calls: string[] = [];
    const fetch: FetchLike = async (url) => {
      calls.push(url);
      return url in files ? jsonResponse(files[url]) : jsonResponse({}, 404);
    };
    return { calls, fetch };
  };

  it("lists and loads forts, caching each fort", async () => {
    const { calls, fetch } = counting();
    const repo = fetchFortRepository("/forts", fetch);
    assert.deepEqual(await repo.list(), [{ id: "testgad", name: "Testgad", nameMr: "टेस्टगड" }]);
    assert.equal((await repo.get("testgad")).name, "Testgad");
    await repo.get("testgad");
    assert.equal(calls.filter((c) => c.endsWith("testgad.json")).length, 1);
  });

  it("maps 404 to FortNotFoundError and validates content", async () => {
    const repo = fetchFortRepository("/forts", counting().fetch);
    await assert.rejects(repo.get("missing"), FortNotFoundError);
    await assert.rejects(repo.get("broken"), FortValidationError);
  });

  it("refuses ids that could escape the forts folder", async () => {
    const { calls, fetch } = counting();
    await assert.rejects(fetchFortRepository("/forts", fetch).get("../secrets"), FortNotFoundError);
    assert.equal(calls.length, 0);
  });
});
