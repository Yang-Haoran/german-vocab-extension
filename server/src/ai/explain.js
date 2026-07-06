const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_EXPLAIN_MODEL = "gemma-4-26b-a4b-it";
const DEFAULT_FALLBACK_MODEL = "gemini-3.1-flash-lite";

export async function generateAiExplanation(word) {
  const apiKey = getApiKey();

  if (!apiKey) {
    return "AI 讲解还没有配置 Gemini API Key。请在服务器 .env 中设置 GEMINI_API_KEY。";
  }

  const models = getCandidateModels();
  let lastError = null;

  for (const model of models) {
    try {
      return await callGemini(model, apiKey, buildPrompt(word));
    } catch (error) {
      lastError = error;
      console.error(`AI explanation failed with ${model}`, error);
    }
  }

  throw lastError || new Error("AI explanation failed.");
}

async function callGemini(model, apiKey, prompt) {
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 700
      }
    })
  });

  const data = await response.json().catch(async () => ({
    error: { message: await response.text() }
  }));

  if (!response.ok) {
    const message = data?.error?.message || `Gemini request failed with ${response.status}`;
    throw new Error(message);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty explanation.");
  }

  return text;
}

function buildPrompt(word) {
  return `你是一位面向中文母语者的德语老师。请讲解这个德语生词，语气简洁、实用，适合 Telegram 阅读。

要求：
- 用中文解释。
- 不要输出 Markdown 表格。
- 不要写太长，总长度控制在 900 个中文字符以内。
- 如果能判断 telc/CEFR 难度，请给出 A1/A2/B1/B2/C1。
- 给出 2-4 个德语同义词或近义表达；如果没有合适同义词，就给常见搭配。
- 给 1 个简单例句，配中文翻译。
- 最后给一个记忆提示。

生词：${word.original || ""}
中文释义：${word.translation || ""}
词性：${word.part_of_speech || ""}
原形：${word.base_form || ""}
冠词：${word.article || ""}
复数：${word.plural || ""}
原解释：${word.explanation || ""}
原句：${word.context_text || ""}
原句中文：${word.context_translation || ""}

请按这个结构输出：
等级：...
核心意思：...
用法：...
近义/搭配：...
例句：...
记忆提示：...`;
}

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
}

function getCandidateModels() {
  const primary = process.env.AI_EXPLAIN_MODEL || DEFAULT_EXPLAIN_MODEL;
  const fallback = process.env.AI_EXPLAIN_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  return [...new Set([primary, fallback].filter(Boolean))];
}
