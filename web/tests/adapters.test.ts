import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchFortRepository } from "../src/adapters/fetchFortRepository.ts";
import { httpClimbPredictor, PredictionError } from "../src/adapters/httpClimbPredictor.ts";
import { naismithPredictor } from "../src/adapters/naismithPredictor.ts";
import type { FetchLike } from "../src/adapters/http.ts";
import { FortValidationError } from "../src/domain/fort.ts";
import { FortNotFoundError } from "../src/ports/fortRepository.ts";
import { jsonResponse, sampleFort } from "./fixtures.ts";

const input = { distanceKm: 3, elevationGainM: 600, startHour: 7, groupSize: 2 };

describe("httpClimbPredictor", () => {
  it("posts snake_case features and maps the response", async () => {
    const seen: { url: string; body: unknown }[] = [];
    const fetch: FetchLike = async (url, init) => {
      seen.push({ url, body: JSON.parse(String(init?.body)) });
      return jsonResponse({ minutes: 112.4, baseline_minutes: 96, model: "tabpfn" });
    };
    const est = await httpClimbPredictor({ baseUrl: "https://api.test/", fetch }).predict(input);
    assert.deepEqual(est, { minutes: 112, baselineMinutes: 96, source: "tabpfn" });
    assert.equal(seen[0]?.url, "https://api.test/predict");
    assert.deepEqual(seen[0]?.body, { distance_km: 3, elevation_gain_m: 600, start_hour: 7, group_size: 2 });
  });

  it("raises on HTTP errors and malformed bodies", async () => {
    const p500 = httpClimbPredictor({ baseUrl: "x", fetch: async () => jsonResponse({}, 500) });
    await assert.rejects(p500.predict(input), PredictionError);
    const bad = httpClimbPredictor({ baseUrl: "x", fetch: async () => jsonResponse({ minutes: -1, baseline_minutes: 1, model: "tabpfn" }) });
    await assert.rejects(bad.predict(input), /Malformed/);
    const unknownModel = httpClimbPredictor({ baseUrl: "x", fetch: async () => jsonResponse({ minutes: 9, baseline_minutes: 1, model: "gpt" }) });
    await assert.rejects(unknownModel.predict(input), /Malformed/);
  });

  it("aborts slow requests", async () => {
    const hang: FetchLike = (_u, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    await assert.rejects(httpClimbPredictor({ baseUrl: "x", fetch: hang, timeoutMs: 10 }).predict(input), /aborted/);
  });
});

describe("naismithPredictor", () => {
  it("returns the rule-of-thumb estimate", async () => {
    assert.deepEqual(await naismithPredictor.predict(input), { minutes: 96, baselineMinutes: 96, source: "naismith" });
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
