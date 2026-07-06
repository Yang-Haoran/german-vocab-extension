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

  return cleanExplanation(text);
}

function buildPrompt(word) {
  return `请直接生成一段中文德语生词讲解。

绝对规则：
1. 只输出最终讲解，不要复述任务、角色、要求或输入字段。
2. 不要输出英文说明，不要写 Role、Tone、Target Word、Constraints、Self-Correction、Valid、Concise 等自检内容。
3. 不要使用 Markdown 星号、表格、代码块、项目符号。
4. 总长度控制在 450 个中文字符以内。
5. 必须严格使用下面 6 行格式，每个标题只出现一次：
等级：
核心意思：
用法：
近义/搭配：
例句：
记忆提示：

可用信息：
生词：${word.original || ""}
中文释义：${word.translation || ""}
词性：${word.part_of_speech || ""}
原形：${word.base_form || ""}
冠词：${word.article || ""}
复数：${word.plural || ""}
已有解释：${word.explanation || ""}
原句：${word.context_text || ""}
原句中文：${word.context_translation || ""}

现在直接输出 6 行中文讲解。`;
}

function cleanExplanation(value) {
  let text = String(value || "").trim();

  const firstHeadingIndex = text.search(/等级[:：]/);
  if (firstHeadingIndex > 0) {
    text = text.slice(firstHeadingIndex);
  }

  text = text
    .replace(/\*+/g, "")
    .replace(/`+/g, "")
    .replace(/\$?\\rightarrow\$?/g, "→")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !isMetaLine(line))
    .join("\n")
    .trim();

  return text;
}

function isMetaLine(line) {
  return /^(Role|Tone|Target Word|Meaning|Constraints|Word|Type|Level|Synonyms|Collocations|Example|Memory Tip|Concise|Valid|Difficulty included|Self-Correction)/i.test(line);
}

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
}

function getCandidateModels() {
  const primary = process.env.AI_EXPLAIN_MODEL || DEFAULT_EXPLAIN_MODEL;
  const fallback = process.env.AI_EXPLAIN_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  return [...new Set([primary, fallback].filter(Boolean))];
}
