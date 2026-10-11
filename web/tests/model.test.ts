import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeGemma, pickGemmaModel } from "../src/domain/model.ts";

describe("describeGemma", () => {
  it("parses generation and size", () => {
    assert.deepEqual(describeGemma("gemma-2-2b-it-q4f16_1-MLC"), { id: "gemma-2-2b-it-q4f16_1-MLC", generation: 2, paramsB: 2 });
    assert.deepEqual(describeGemma("gemma-2b-it-q4f32_1-MLC"), { id: "gemma-2b-it-q4f32_1-MLC", generation: 1, paramsB: 2 });
    assert.equal(describeGemma("gemma3-1b-it-q4f16_1-MLC")?.generation, 3);
  });

  it("ignores non-Gemma and non-instruct builds", () => {
    assert.equal(describeGemma("Llama-3.2-1B-Instruct-q4f16_1-MLC"), null);
    assert.equal(describeGemma("gemma-2-2b-q4f16_1-MLC"), null);
  });
});

describe("pickGemmaModel", () => {
  const list = [
    "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    "gemma-2b-it-q4f16_1-MLC",
    "gemma-2-2b-it-q4f32_1-MLC",
    "gemma-2-2b-it-q4f16_1-MLC",
    "gemma-2-9b-it-q4f16_1-MLC",
  ];

  it("prefers the newest generation that fits a phone, in f16", () => {
    assert.equal(pickGemmaModel(list), "gemma-2-2b-it-q4f16_1-MLC");
  });

  it("skips models too big for a phone", () => {
    assert.equal(pickGemmaModel(["gemma-2-9b-it-q4f16_1-MLC"]), null);
  });

  it("falls back to f32 builds when the GPU lacks shader-f16", () => {
    assert.equal(pickGemmaModel(list, { supportsF16: false }), "gemma-2-2b-it-q4f32_1-MLC");
  });

  it("prefers a newer generation even if smaller", () => {
    assert.equal(pickGemmaModel([...list, "gemma-3-1b-it-q4f16_1-MLC"]), "gemma-3-1b-it-q4f16_1-MLC");
  });

  it("returns null when no Gemma is listed", () => {
    assert.equal(pickGemmaModel(["Llama-3.2-1B-Instruct-q4f16_1-MLC"]), null);
  });
});
