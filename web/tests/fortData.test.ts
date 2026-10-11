// Guards the shipped fort JSON: valid, indexed, and small enough for the on-device model.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFort } from "../src/domain/fort.ts";
import { buildAskMessages } from "../src/domain/prompt.ts";

const dir = join(import.meta.dirname, "..", "public", "forts");
const read = (f: string): unknown => JSON.parse(readFileSync(join(dir, f), "utf8"));
const fortFiles = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json");

/**
 * Gemma 2 2B in WebLLM has a 4k-token context; Devanagari/English mixes run ~3 chars/token.
 * Keep the prompt well under half the window so the answer has room.
 */
const PROMPT_CHAR_BUDGET = 6000;

describe("shipped fort data", () => {
  it("has at least three forts", () => assert.ok(fortFiles.length >= 3));

  for (const file of fortFiles) {
    describe(file, () => {
      const fort = parseFort(read(file));

      it("id matches the file name", () => assert.equal(`${fort.id}.json`, file));

      it("cites at least one https source", () => {
        assert.ok(fort.sources.length > 0);
        assert.ok(fort.sources.every((s) => s.startsWith("https://")));
      });

      it("does not invent a last-departure time unless verified", () => {
        if (!fort.verified) assert.equal(fort.returnTransport.lastDepartureFromBase, null);
      });

      it("fits the on-device prompt budget", () => {
        const prompt = buildAskMessages(fort, "x".repeat(200), "mr")[0]?.content ?? "";
        assert.ok(prompt.length < PROMPT_CHAR_BUDGET, `${prompt.length} chars`);
      });
    });
  }

  it("index.json lists exactly the shipped forts", () => {
    const index = read("index.json") as { id: string; name: string; nameMr: string }[];
    assert.deepEqual(index.map((e) => `${e.id}.json`).sort(), [...fortFiles].sort());
    for (const e of index) {
      const fort = parseFort(read(`${e.id}.json`));
      assert.equal(e.name, fort.name);
      assert.equal(e.nameMr, fort.nameMr);
    }
  });
});
