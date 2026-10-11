import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAskMessages, EmptyQuestionError, MAX_QUESTION_CHARS, renderFortNotes } from "../src/domain/prompt.ts";
import { sampleFort } from "./fixtures.ts";

describe("buildAskMessages", () => {
  const fort = sampleFort();

  it("puts instructions, notes and question in a single user turn (Gemma has no system role)", () => {
    const msgs = buildAskMessages(fort, "  Where is water?  ", "en");
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0]?.role, "user");
    const c = msgs[0]?.content ?? "";
    assert.match(c, /You are Killedar, a trek companion for Testgad/);
    assert.match(c, /FORT NOTES:\nFORT: Testgad/);
    assert.match(c, /Tank near the top gate/);
    assert.ok(c.endsWith("QUESTION: Where is water?"));
  });

  it("asks for Marathi in Devanagari when lang is mr", () => {
    const c = buildAskMessages(fort, "पाणी कुठे आहे?", "mr")[0]?.content ?? "";
    assert.match(c, /Marathi using Devanagari/);
    assert.doesNotMatch(c, /Answer in simple English/);
  });

  it("forbids invented logistics", () => {
    const c = buildAskMessages(fort, "last bus?", "en")[0]?.content ?? "";
    assert.match(c, /Never invent bus times/);
  });

  it("rejects empty questions", () => {
    assert.throws(() => buildAskMessages(fort, "   ", "en"), EmptyQuestionError);
  });

  it("caps very long questions", () => {
    const c = buildAskMessages(fort, "x".repeat(MAX_QUESTION_CHARS + 100), "en")[0]?.content ?? "";
    assert.ok(c.endsWith(`QUESTION: ${"x".repeat(MAX_QUESTION_CHARS)}`));
  });
});

describe("renderFortNotes", () => {
  it("includes every section", () => {
    const notes = renderFortNotes(sampleFort());
    for (const h of ["TRAILS:", "LANDMARKS:", "WATER:", "SAFETY:", "GETTING BACK:", "HISTORY:"]) {
      assert.ok(notes.includes(h), h);
    }
  });
});
