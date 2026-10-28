// Structured (JSON) Gemini calls for lessons and writing feedback.
// Tries the configured models in order; waits and retries on 429/500/503 (free tier is often busy).

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODELS = "gemini-flash-latest,gemini-flash-lite-latest";
const RETRY_WAITS_MS = [10_000, 30_000];
const REQUEST_TIMEOUT_MS = 180_000;

export async function geminiJson(prompt, schema, { temperature = 0.4, models: modelList } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const models = String(modelList || process.env.LEARNING_MODELS || DEFAULT_MODELS)
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const errors = [];

  for (const model of models) {
    for (let attempt = 0; attempt <= RETRY_WAITS_MS.length; attempt += 1) {
      try {
        return await callOnce(model, apiKey, prompt, schema, temperature);
      } catch (error) {
        errors.push(`${model}: ${error.message}`);
        if (!error.retryable || attempt === RETRY_WAITS_MS.length) {
          break;
        }
        await delay(RETRY_WAITS_MS[attempt]);
      }
    }
  }

  throw new Error(`Gemini failed: ${errors.slice(-3).join(" | ")}`);
}

async function callOnce(model, apiKey, prompt, schema, temperature) {
  const response = await fetch(`${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature, responseMimeType: "application/json", responseSchema: schema }
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(`${response.status} ${String(data?.error?.message || "").slice(0, 160)}`);
    error.retryable = [429, 500, 503].includes(response.status);
    throw error;
  }

  const text = (data?.candidates?.[0]?.content?.parts || [])
    .filter((part) => !part.thought)
    .map((part) => part.text || "")
    .join("");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("returned text is not JSON");
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
