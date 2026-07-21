import crypto from "node:crypto";
import { Router } from "express";
import { query } from "../db.js";

export const RESULT_CONFIG = {
  show: {
    label: "显示答案",
    intervalDays: 0,
    difficultyDelta: 0,
    countAsReview: false
  },
  know: {
    label: "认识",
    intervalDays: 7,
    difficultyDelta: -1,
    countAsReview: true
  },
  unsure: {
    label: "模糊",
    intervalDays: 2,
    difficultyDelta: 0,
    countAsReview: true
  },
  forgot: {
    label: "不认识",
    intervalDays: 1,
    difficultyDelta: 1,
    countAsReview: true
  }
};

export const reviewsRouter = Router();

reviewsRouter.get("/:wordId/:result", async (req, res, next) => {
  try {
    const wordId = Number(req.params.wordId);
    const result = req.params.result;
    const token = String(req.query.token || "");

    if (!Number.isSafeInteger(wordId) || !RESULT_CONFIG[result]) {
      return renderMessage(res, 400, "无效的复习操作", "这个复习链接格式不正确。", "error");
    }

    if (!isValidReviewToken(wordId, result, token)) {
      return renderMessage(res, 403, "链接已失效或无权限", "这个复习链接没有通过签名校验。", "error");
    }

    const word = await findWord(wordId);
    if (!word) {
      return renderMessage(res, 404, "词条不存在", "这个词可能已经被删除或还没有同步。", "error");
    }

    if (result === "show") {
      return renderAnswer(res, word);
    }

    const updated = await applyReviewResult(wordId, result);
    return renderMessage(
      res,
      200,
      `已记录：${RESULT_CONFIG[result].label}`,
      `下次复习：${formatDate(updated.next_review_at)}`,
      "success"
    );
  } catch (error) {
    next(error);
  }
});

reviewsRouter.use((error, _req, res, _next) => {
  console.error(error);
  renderMessage(res, 500, "服务器错误", "复习记录暂时没有保存成功，请稍后再试。", "error");
});

export function createReviewUrl(wordId, result) {
  const baseUrl = getPublicBaseUrl();
  const token = createReviewToken(wordId, result);
  return `${baseUrl}/api/reviews/${wordId}/${result}?token=${token}`;
}

function getPublicBaseUrl() {
  const fallback = `http://localhost:${process.env.PORT || 3000}`;
  return String(process.env.PUBLIC_BASE_URL || fallback).replace(/\/+$/, "");
}

function createReviewToken(wordId, result) {
  const secret = getReviewSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(`${wordId}:${result}`)
    .digest("hex")
    .slice(0, 32);
}

function isValidReviewToken(wordId, result, token) {
  const expected = createReviewToken(wordId, result);
  return safeEqual(expected, token);
}

function getReviewSecret() {
  const secret = process.env.REVIEW_ACTION_SECRET || process.env.API_SECRET;
  if (!secret) {
    throw new Error("REVIEW_ACTION_SECRET or API_SECRET is required for review actions.");
  }
  return secret;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function findWord(wordId) {
  const result = await query(
    `select *
     from words
     where id = $1`,
    [wordId]
  );
  return result.rows[0];
}

export async function applyReviewResult(wordId, result) {
  const config = RESULT_CONFIG[result];
  const updateResult = await query(
    `update words
     set review_count = review_count + $2,
         difficulty = least(5, greatest(1, difficulty + $3)),
         last_result = $4,
         last_reviewed_at = now(),
         reviewed_at = now(),
         next_review_at = now() + ($5::text || ' days')::interval,
         updated_at = now()
     where id = $1
     returning *`,
    [
      wordId,
      config.countAsReview ? 1 : 0,
      config.difficultyDelta,
      result,
      config.intervalDays
    ]
  );

  return updateResult.rows[0];
}

function renderAnswer(res, word) {
  const meta = [
    word.article && `冠词：${word.article}`,
    word.plural && `复数：${word.plural}`,
    word.base_form && `原形：${word.base_form}`,
    word.part_of_speech && `词性：${word.part_of_speech}`
  ].filter(Boolean).join(" · ");

  const body = [
    `<p><strong>${escapeHtml(word.original)}</strong> = ${escapeHtml(word.translation)}</p>`,
    meta ? `<p>${escapeHtml(meta)}</p>` : "",
    word.explanation ? `<p>${escapeHtml(word.explanation)}</p>` : "",
    word.context_text ? `<p><strong>例句：</strong>${escapeHtml(word.context_text)}</p>` : "",
    word.context_translation ? `<p>${escapeHtml(word.context_translation)}</p>` : "",
    `<p class="hint">回到 Telegram 点“认识 / 模糊 / 不认识”来记录复习结果。</p>`
  ].filter(Boolean).join("\n");

  return renderPage(res, 200, "答案", body, "success");
}

function renderMessage(res, status, title, message, type) {
  return renderPage(res, status, title, `<p>${escapeHtml(message)}</p>`, type);
}

function renderPage(res, status, title, body, type) {
  res.status(status).type("html").send(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f4f7fb; color: #172033; }
      main { max-width: 680px; margin: 48px auto; padding: 24px; background: white; border-radius: 16px; box-shadow: 0 8px 24px rgb(15 23 42 / 8%); }
      h1 { margin-top: 0; color: ${type === "error" ? "#be123c" : "#15803d"}; }
      p { line-height: 1.65; }
      .hint { color: #64748b; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      ${body}
    </main>
  </body>
</html>`);
}

function formatDate(value) {
  if (!value) {
    return "未设置";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: process.env.DAILY_REVIEW_TIMEZONE || "Europe/Berlin",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
