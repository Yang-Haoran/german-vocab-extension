import assert from "node:assert/strict";
import test from "node:test";
import { buildCloze, clozeHint } from "../src/learning/cloze.js";

test("hides the word in its sentence", () => {
  const cloze = buildCloze({ original: "Entscheidung", context_text: "Die Regierung hat eine wichtige Entscheidung getroffen." });
  assert.equal(cloze.answer, "Entscheidung");
  assert.match(cloze.text, /^Die Regierung hat eine wichtige ＿+ getroffen\.$/);
});

test("matches whole words only, case-insensitive", () => {
  assert.equal(buildCloze({ original: "arbeit", context_text: "Die Zusammenarbeit klappt gut." }), null);
  assert.equal(buildCloze({ original: "arbeit", context_text: "Arbeit macht Spaß." }).answer, "Arbeit");
  assert.equal(buildCloze({ original: "über", context_text: "Er spricht über das Problem." }).answer, "über");
});

test("no card without a sentence that contains the word", () => {
  assert.equal(buildCloze({ original: "Haus", context_text: "" }), null);
  assert.equal(buildCloze({ original: "Haus", context_text: "Das Auto ist neu." }), null);
  assert.equal(buildCloze({ original: "", context_text: "Das Haus ist neu." }), null);
});

test("long sentences are cut around the blank", () => {
  const sentence = `${"Am Anfang steht viel Text. ".repeat(10)}Hier kommt das Zielwort vor. ${"Danach noch mehr Text. ".repeat(10)}`;
  const cloze = buildCloze({ original: "Zielwort", context_text: sentence });
  assert.ok(cloze.text.length <= 245);
  assert.ok(cloze.text.startsWith("…") && cloze.text.endsWith("…"));
  assert.ok(cloze.text.includes("＿"));
});

test("hints: own mistake for writing cards, meaning and first letter otherwise", () => {
  assert.equal(clozeHint({ origin: "writing", mistake: "auf die Arbeit" }, "zur Arbeit"), "你当时写的是：auf die Arbeit");
  assert.equal(clozeHint({ translation: "决定" }, "Entscheidung"), "决定，E…（12 个字母）");
});
