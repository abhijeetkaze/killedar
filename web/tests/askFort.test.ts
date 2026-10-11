import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeAskFort } from "../src/app/askFort.ts";
import { EmptyQuestionError } from "../src/domain/prompt.ts";
import { collect, memoryForts, sampleFort, scriptedModel } from "./fixtures.ts";

describe("askFort", () => {
  it("streams the model's answer for a grounded prompt", async () => {
    const model = scriptedModel(["Water is ", "near the top gate."]);
    const ask = makeAskFort({ forts: memoryForts(sampleFort()), model });
    assert.equal(await collect(ask("testgad", "Where is water?", "en")), "Water is near the top gate.");
    assert.equal(model.received.length, 1);
    assert.match(model.received[0]?.[0]?.content ?? "", /Tank near the top gate/);
  });

  it("never calls the model for an empty question", async () => {
    const model = scriptedModel(["should not appear"]);
    const ask = makeAskFort({ forts: memoryForts(sampleFort()), model });
    await assert.rejects(collect(ask("testgad", " ", "en")), EmptyQuestionError);
    assert.equal(model.received.length, 0);
  });
});
