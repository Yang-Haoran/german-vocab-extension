const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const MAX_CACHE_ENTRIES = 300;
const CACHE_VERSION = "quality-v2";
let rateLimitUntil = 0;
const memoryCache = new Map();
const pendingRequests = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    return false;
  }

  if (message.type !== "TRANSLATE_SELECTION") {
    return false;
  }

  translateSelection(message.payload)
    .then((translation) => sendResponse({ ok: true, translation }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function translateSelection({ selectedText, context, exampleSentence }) {
  const settings = await chrome.storage.local.get([
    "geminiApiKey",
    "geminiModel",
    "translationCache"
  ]);
  const apiKey = settings.geminiApiKey?.trim();
  const model = settings.geminiModel?.trim() || DEFAULT_MODEL;
  const cache = settings.translationCache || {};
  const cacheKey = createCacheKey(selectedText, context, exampleSentence);

  const cachedTranslation = memoryCache.get(cacheKey) || cache[cacheKey];
  if (cachedTranslation) {
    return {
      ...cachedTranslation,
      original: selectedText,
      context: exampleSentence
    };
  }

  if (!apiKey) {
    throw new Error("请先在插件设置中填写 Gemini API Key。");
  }

  if (Date.now() < rateLimitUntil) {
    const seconds = Math.ceil((rateLimitUntil - Date.now()) / 1000);
    throw new Error(`Gemini 免费额度请求过快，请等待约 ${seconds} 秒后再查询新单词。`);
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const request = requestTranslation({
    apiKey,
    model,
    selectedText,
    context,
    exampleSentence,
    cacheKey,
    cache
  });
  pendingRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

async function requestTranslation({
  apiKey,
  model,
  selectedText,
  context,
  exampleSentence,
  cacheKey,
  cache
}) {
  const prompt = buildPrompt(selectedText, context, exampleSentence);
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 429) {
      const retrySeconds = getRetrySeconds(data?.error?.message) || 60;
      rateLimitUntil = Date.now() + retrySeconds * 1000;
      throw new Error(`Gemini 免费额度请求过快，请等待约 ${retrySeconds} 秒后再查询新单词。`);
    }

    const apiMessage = data?.error?.message || `Gemini 请求失败（${response.status}）`;
    throw new Error(apiMessage);
  }

  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini 没有返回翻译结果，请重新选择文本。");
  }

  try {
    const parsed = JSON.parse(rawText);
    const translation = normalizeTranslation(parsed, selectedText, exampleSentence);
    memoryCache.set(cacheKey, translation);
    saveToCache(cache, cacheKey, translation);
    return translation;
  } catch {
    throw new Error("无法解析 Gemini 返回的结果，请重试。");
  }
}

function createCacheKey(selectedText, context, exampleSentence) {
  return [
    CACHE_VERSION,
    normalizeCacheText(selectedText),
    normalizeCacheText(context),
    normalizeCacheText(exampleSentence)
  ].join("::");
}

function normalizeCacheText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

async function saveToCache(cache, cacheKey, translation) {
  const updatedCache = {
    ...cache,
    [cacheKey]: {
      ...translation,
      cachedAt: new Date().toISOString()
    }
  };

  const entries = Object.entries(updatedCache)
    .sort(([, a], [, b]) => String(b.cachedAt).localeCompare(String(a.cachedAt)))
    .slice(0, MAX_CACHE_ENTRIES);

  await chrome.storage.local.set({ translationCache: Object.fromEntries(entries) });
}

function getRetrySeconds(message = "") {
  const match = message.match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(Number(match[1])) : 0;
}

function buildPrompt(selectedText, context, exampleSentence) {
  return `
你是一名帮助中文母语者学习德语的老师。
请结合所在上下文，分析用户选中的德语文本，并只返回一个 JSON 对象，不要添加 Markdown。

选中文本：${JSON.stringify(selectedText)}
所在上下文：${JSON.stringify(context)}
保存到单词本的例句：${JSON.stringify(exampleSentence)}

返回字段：
{
  "original": "选中的原文",
  "translation": "结合当前语境后自然准确的中文翻译",
  "partOfSpeech": "词性；如果是句子则写句子",
  "cefrLevel": "估计的 telc/CEFR 等级，只能是 A1、A2、B1、B2、C1；无法判断则为空字符串",
  "baseForm": "词典原形；不适用则为空字符串",
  "article": "名词冠词 der/die/das；不适用则为空字符串",
  "plural": "名词复数；不适用则为空字符串",
  "explanation": "说明该词在当前上下文中的含义和用法",
  "contextTranslation": "仅翻译保存到单词本的例句，不要翻译整段上下文"
}
`.trim();
}

function normalizeCefrLevel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return ["A1", "A2", "B1", "B2", "C1"].includes(normalized) ? normalized : "";
}

function normalizeTranslation(value, selectedText, context) {
  const text = (field, fallback = "") =>
    typeof value?.[field] === "string" ? value[field].trim() : fallback;

  return {
    original: text("original", selectedText),
    translation: text("translation"),
    partOfSpeech: text("partOfSpeech"),
    cefrLevel: normalizeCefrLevel(text("cefrLevel")),
    baseForm: text("baseForm"),
    article: text("article"),
    plural: text("plural"),
    explanation: text("explanation"),
    context,
    contextTranslation: text("contextTranslation")
  };
}
