// Fill-in-the-blank cards: hide the saved word inside the sentence it came from,
// so reviewing means producing the German word in context instead of just recognising it.

const MAX_SENTENCE = 240;
const NOT_LETTER_BEFORE = "(?<![\\p{L}\\p{N}])";
const NOT_LETTER_AFTER = "(?![\\p{L}\\p{N}])";

export function buildCloze(word) {
  const target = String(word?.original || "").replace(/\s+/g, " ").trim();
  const sentence = String(word?.context_text || "").replace(/\s+/g, " ").trim();

  if (!target || !sentence || target.length > 60) {
    return null;
  }

  const pattern = new RegExp(`${NOT_LETTER_BEFORE}${escapeRegExp(target)}${NOT_LETTER_AFTER}`, "iu");
  const match = sentence.match(pattern);

  if (!match) {
    return null;
  }

  const blank = "＿".repeat(Math.min(Math.max(3, Math.ceil(match[0].length / 2)), 8));
  const before = sentence.slice(0, match.index);
  const after = sentence.slice(match.index + match[0].length);

  return {
    text: windowAround(before, blank, after),
    answer: match[0]
  };
}

// Hint shown under the blank: your own mistake for writing cards, otherwise meaning + first letter.
export function clozeHint(word, answer) {
  if (word?.origin === "writing" && word.mistake) {
    return `你当时写的是：${word.mistake}`;
  }

  const letters = answer.replace(/[^\p{L}]/gu, "").length;
  const meaning = word?.translation ? `${word.translation}，` : "";
  return `${meaning}${answer.charAt(0)}…（${letters} 个字母）`;
}

function windowAround(before, blank, after) {
  const full = `${before}${blank}${after}`;

  if (full.length <= MAX_SENTENCE) {
    return full;
  }

  const side = Math.floor((MAX_SENTENCE - blank.length) / 2);
  const head = before.length > side ? `…${before.slice(-side)}` : before;
  const tail = after.length > side ? `${after.slice(0, side)}…` : after;
  return `${head}${blank}${tail}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
