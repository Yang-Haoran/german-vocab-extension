import assert from "node:assert/strict";
import test from "node:test";
import { extractParagraphs } from "../src/learning/articles.js";
import { validateCorrection } from "../src/learning/correct.js";
import { splitSentences, validateLesson } from "../src/learning/lesson.js";

const TEXT = "Die Stadt Karlsruhe baut eine neue Bahn. Die Arbeiten beginnen im November. Viele Pendler freuen sich darauf.";

test("lesson keywords must appear in the text, with a sentence from it", () => {
  const lesson = validateLesson({
    title_de: "Neue Bahn", text_de: TEXT, text_zh: "…", question_de: "Wie kommst du zur Arbeit?", question_zh: "…",
    keywords: [
      { word: "Arbeiten", lemma: "die Arbeit", article: "die", plural: "-en", zh: "工程", sentence: "Die Arbeiten beginnen im November." },
      { word: "freuen sich", lemma: "sich freuen", article: "", plural: "", zh: "期待", sentence: "erfunden" },
      { word: "Straßenbahn", lemma: "die Straßenbahn", article: "die", plural: "-en", zh: "有轨电车", sentence: "x" }
    ]
  });
  assert.equal(lesson.keywords.length, 2);
  assert.equal(lesson.keywords[1].sentence, "Viele Pendler freuen sich darauf.");
  assert.ok(!lesson.keywords.some((keyword) => keyword.word === "Straßenbahn"));
});

test("sentence splitting keeps German quotes and numbers", () => {
  assert.deepEqual(splitSentences("Es kostet 3.50 Euro. „Gut“, sagt sie. 2026 kommt mehr."), [
    "Es kostet 3.50 Euro.", "„Gut“, sagt sie.", "2026 kommt mehr."
  ]);
});

test("corrections must match the learner's text; cards need the fix inside a corrected sentence", () => {
  const original = "Ich fahre mit die Bahn zu Arbeit. Das ist gut.";
  const result = validateCorrection({
    is_german: true,
    corrected: "Ich fahre mit der Bahn zur Arbeit. Das ist gut.",
    errors: [
      { wrong: "mit die Bahn", right: "mit der Bahn", type: "格", explain_zh: "mit 后面跟第三格" },
      { wrong: "zu Arbeit", right: "zur Arbeit", type: "介词", explain_zh: "zu + der = zur" },
      { wrong: "Ich gehe", right: "Ich fahre", type: "用词", explain_zh: "原文里没有这句" },
      { wrong: "Das ist gut.", right: "Das ist super.", type: "其他", explain_zh: "改法不在 corrected 里" },
      { wrong: "Bahn", right: "Bahn", type: "瞎写", explain_zh: "没改" }
    ],
    better: "", praise_zh: "句子结构很清楚"
  }, original);
  assert.deepEqual(result.errors.map((error) => error.right), ["mit der Bahn", "zur Arbeit", "Das ist super."]);
  assert.deepEqual(result.errors.map((error) => error.card), [true, true, false]);
  assert.equal(result.errors[0].sentence, "Ich fahre mit der Bahn zur Arbeit.");
});

test("non-German text is flagged", () => {
  assert.equal(validateCorrection({ is_german: false, corrected: "", errors: [], better: "", praise_zh: "请用德语" }, "你好").isGerman, false);
});

test("article text keeps body paragraphs and drops boilerplate", () => {
  const html = `<nav><p>Menü Startseite Nachrichten Sport Wetter und noch mehr Links hier</p></nav>
    <p class="x">Die Stadt Karlsruhe baut eine neue Bahn &amp; die Arbeiten beginnen im November dieses Jahres.</p>
    <p>Kurz.</p>
    <p>Wir verwenden Cookies, um Ihnen das beste Erlebnis auf unserer Website zu bieten, bitte zustimmen.</p>
    <script>var p = "<p>kein Text aus Skripten bitte, das ist nur Code und keine Nachricht</p>";</script>`;
  assert.equal(extractParagraphs(html), "Die Stadt Karlsruhe baut eine neue Bahn & die Arbeiten beginnen im November dieses Jahres.");
});
