// Turns a real article into a short B2 reading text, three keywords and one question to answer.
import { geminiJson } from "./gemini.js";

const LEVEL = process.env.GERMAN_LEVEL || "B2";

const LESSON_SCHEMA = {
  type: "OBJECT",
  properties: {
    title_de: { type: "STRING" },
    text_de: { type: "STRING" },
    text_zh: { type: "STRING" },
    keywords: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          lemma: { type: "STRING" },
          article: { type: "STRING" },
          plural: { type: "STRING" },
          zh: { type: "STRING" },
          sentence: { type: "STRING" }
        },
        required: ["word", "lemma", "article", "plural", "zh", "sentence"]
      }
    },
    question_de: { type: "STRING" },
    question_zh: { type: "STRING" }
  },
  required: ["title_de", "text_de", "text_zh", "keywords", "question_de", "question_zh"]
};

export async function createLesson(article, articleText) {
  const prompt = `你在给一位住在德国、德语 ${LEVEL} 水平的中国读者做每日德语阅读。他明年开始 IT 方向的 Ausbildung，12 月搬到 Karlsruhe 做 FSJ。

根据下面这篇德语文章写一课：
- title_de：德语标题（可以沿用原标题）
- text_de：把文章改写成 ${LEVEL} 水平的德语短文，110～160 词。只写原文里有的事实，不要补充原文没有的信息；原文很短就写短一点。用自然的新闻德语，可以有从句、被动态、名词化，但不要太生僻的词
- text_zh：text_de 的中文翻译
- keywords：从 text_de 里挑 3 个对 ${LEVEL} 最有用的词或搭配（优先名词动词搭配、带固定介词的动词、常用名词）。word 必须和 text_de 里的写法一模一样（包括变格变位），sentence 是 text_de 里包含这个词的那一整句，原样照抄。lemma 是原形（可分动词用 | 标出，如 an|kündigen），名词写 article（der/die/das）和 plural（如 -en），不是名词就留空。zh 是中文意思
- question_de：一个开放问题，让读者用 2～4 句德语回答：把文章话题和他自己的生活联系起来（看法、经历、在德国的生活、IT 或 Ausbildung）。不要问原文细节
- question_zh：问题的中文翻译

来源：${article.source}
标题：${article.title}
正文：
${articleText}`;

  const lesson = await geminiJson(prompt, LESSON_SCHEMA);
  return validateLesson(lesson);
}

// Keywords must really appear in the text, with a sentence copied from it; anything else is dropped.
export function validateLesson(lesson) {
  const text = String(lesson?.text_de || "").trim();
  const sentences = splitSentences(text);
  const keywords = [];

  for (const keyword of lesson?.keywords || []) {
    const word = String(keyword.word || "").trim();
    if (!word || !text.includes(word)) {
      continue;
    }
    const given = String(keyword.sentence || "").trim();
    const sentence = given && text.includes(given) && given.includes(word)
      ? given
      : sentences.find((candidate) => candidate.includes(word));
    if (!sentence) {
      continue;
    }
    keywords.push({
      word,
      lemma: String(keyword.lemma || "").trim(),
      article: String(keyword.article || "").trim(),
      plural: String(keyword.plural || "").trim(),
      zh: String(keyword.zh || "").trim(),
      sentence
    });
  }

  return {
    title_de: String(lesson?.title_de || "").trim(),
    text_de: text,
    text_zh: String(lesson?.text_zh || "").trim(),
    keywords: keywords.slice(0, 3),
    question_de: String(lesson?.question_de || "").trim(),
    question_zh: String(lesson?.question_zh || "").trim()
  };
}

export function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[„"A-ZÄÖÜ0-9])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}
