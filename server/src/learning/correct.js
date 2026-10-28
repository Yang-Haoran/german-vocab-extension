// Corrects a short German text the learner wrote: minimal corrections, a Chinese reason for each,
// and a more natural version. Each correction can later become a fill-in-the-blank card.
import { geminiJson } from "./gemini.js";
import { splitSentences } from "./lesson.js";

const LEVEL = process.env.GERMAN_LEVEL || "B2";
const MAX_ERRORS = 8;

export const ERROR_TYPES = ["语序", "动词变位", "格", "冠词/词尾", "介词", "时态", "拼写", "用词", "标点", "其他"];

const CORRECTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_german: { type: "BOOLEAN" },
    corrected: { type: "STRING" },
    errors: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          wrong: { type: "STRING" },
          right: { type: "STRING" },
          type: { type: "STRING", enum: ERROR_TYPES },
          explain_zh: { type: "STRING" }
        },
        required: ["wrong", "right", "type", "explain_zh"]
      }
    },
    better: { type: "STRING" },
    praise_zh: { type: "STRING" }
  },
  required: ["is_german", "corrected", "errors", "better", "praise_zh"]
};

export async function correctWriting(text, { question = "", context = "" } = {}) {
  const prompt = `你是一位耐心的德语老师，学生是德语 ${LEVEL} 水平的中国人。批改他写的德语。

要求：
- is_german：这段是不是德语（如果是中文或别的语言，填 false，其余字段留空，praise_zh 用中文提醒他用德语写）
- corrected：在他原文基础上做最少的修改，只改真正的错误（语法、用词、拼写、标点），保留他的意思和写法
- errors：每一处修改单独列一条。wrong 是他原文里错的那一小段（必须和原文一字不差），right 是改正后的写法（必须和 corrected 里一字不差），type 选一个类型，explain_zh 用中文说清楚规则，不超过 40 字
- better：一个更地道的 ${LEVEL}～C1 版本（意思不变）；如果原文已经很地道就留空
- praise_zh：一句具体的中文鼓励，指出他写得好的地方
${question ? `\n他在回答这个问题：${question}` : ""}${context ? `\n话题背景（文章）：${context.slice(0, 800)}` : ""}

学生原文：
${text}`;

  const result = await geminiJson(prompt, CORRECTION_SCHEMA, { temperature: 0.2 });
  return validateCorrection(result, text);
}

// Drops corrections that do not match the learner's text; marks which ones can become review cards.
export function validateCorrection(result, original) {
  const source = normalize(original);
  const corrected = String(result?.corrected || "").trim();
  const normalizedCorrected = normalize(corrected);
  const errors = [];

  for (const error of result?.errors || []) {
    const wrong = String(error.wrong || "").trim();
    const right = String(error.right || "").trim();
    if (!wrong || wrong === right || !source.includes(normalize(wrong))) {
      continue;
    }
    const sentence = right ? splitSentences(corrected).find((candidate) => candidate.includes(right)) : null;
    errors.push({
      wrong,
      right,
      type: ERROR_TYPES.includes(error.type) ? error.type : "其他",
      explain_zh: String(error.explain_zh || "").trim(),
      sentence: sentence || null,
      card: Boolean(right && sentence && normalizedCorrected.includes(normalize(right)) && right.length <= 60)
    });
  }

  return {
    isGerman: result?.is_german !== false,
    corrected,
    errors: errors.slice(0, MAX_ERRORS),
    better: String(result?.better || "").trim(),
    praise: String(result?.praise_zh || "").trim()
  };
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
