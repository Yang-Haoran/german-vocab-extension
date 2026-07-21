import { applyReviewResult, findWord } from "../routes/reviews.js";
import { query } from "../db.js";
import { generateAiExplanation } from "../ai/explain.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const REVIEW_LIMIT = 5;
const POLL_TIMEOUT_SECONDS = 25;
const POLL_DELAY_MS = 1000;

let pollingStarted = false;

export function startReviewBotPolling() {
  const token = getReviewBotToken();

  if (!token) {
    console.warn("Review Telegram bot is not configured. Skipping polling.");
    return;
  }

  if (pollingStarted) {
    return;
  }

  pollingStarted = true;
  prepareReviewBot()
    .then(() => pollLoop(0))
    .catch((error) => {
      console.error("Review bot polling stopped", error);
      pollingStarted = false;
    });
}

async function prepareReviewBot() {
  await telegramApi("deleteWebhook", { drop_pending_updates: false });
}

export async function sendDailyReview() {
  const chatId = getReviewChatId();

  if (!chatId) {
    console.warn("Review Telegram chat id is not configured. Skipping daily review.");
    return { sent: 0 };
  }

  const words = await pickDueWords(REVIEW_LIMIT);

  if (words.length === 0) {
    await sendReviewMessage(chatId, "今天还没有到期的德语单词。去读一篇文章，给未来的自己攒点材料吧。");
    return { sent: 0 };
  }

  await sendReviewMessage(
    chatId,
    `今天复习 ${words.length} 个词。\n\n我会一个一个出题：先回忆，再点“显示答案”。`
  );
  await sendPrompt(chatId, words[0], 1, words.length);

  return { sent: words.length };
}

async function pollLoop(offset) {
  let nextOffset = offset;

  while (pollingStarted) {
    try {
      const updates = await telegramApi("getUpdates", {
        offset: nextOffset,
        timeout: POLL_TIMEOUT_SECONDS,
        allowed_updates: ["message", "callback_query"]
      });

      for (const update of updates.result || []) {
        nextOffset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (error) {
      console.error("Review bot polling failed", error);

      if (isFatalTelegramError(error)) {
        pollingStarted = false;
        return;
      }

      await delay(POLL_DELAY_MS);
    }
  }
}

async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message);
    return;
  }

  if (update.callback_query) {
    await handleCallback(update.callback_query);
  }
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  const text = String(message.text || "").trim();

  if (!chatId || !text) {
    return;
  }

  if (text === "/start") {
    await sendReviewMessage(
      chatId,
      "你好，我是你的德语生词复习 bot。\n\n发送 /review 可以马上开始复习；每天德国时间 9 点，我也会自动提醒你。"
    );
    return;
  }

  if (text === "/review") {
    await startManualReview(chatId);
    return;
  }

  if (text === "/stats") {
    await sendStats(chatId);
    return;
  }

  await sendReviewMessage(chatId, "我现在支持：/review 开始复习，/stats 查看统计。");
}

async function handleCallback(callback) {
  const data = String(callback.data || "");
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;
  const callbackId = callback.id;
  const match = data.match(/^rv:(show|explain|know|unsure|forgot):(\d+)(?::(\d+):(\d+))?$/);

  if (!match || !chatId || !messageId) {
    await answerCallback(callbackId, "这个按钮已经失效了。", true);
    return;
  }

  const action = match[1];
  const wordId = Number(match[2]);
  const currentIndex = Number(match[3] || 1);
  const total = Number(match[4] || REVIEW_LIMIT);
  const word = await findWord(wordId);

  if (!word) {
    await answerCallback(callbackId, "这个词已经不存在了。", true);
    return;
  }

  if (action === "show") {
    await editReviewMessage(chatId, messageId, formatAnswer(word), resultKeyboard(word.id, currentIndex, total));
    await answerCallback(callbackId, "答案已显示");
    return;
  }

  if (action === "explain") {
    await answerCallback(callbackId, "AI 正在讲解...");
    await editAiExplanation(chatId, messageId, word, currentIndex, total);
    return;
  }

  const updated = await applyReviewResult(wordId, action);
  await answerCallback(callbackId, `已记录：${resultLabel(action)}`);
  await editReviewMessage(chatId, messageId, formatRecorded(word, action, updated), []);
  await sendNextDueWord(chatId, wordId, currentIndex + 1, total);
}

async function editAiExplanation(chatId, messageId, word, currentIndex, total) {
  await sendChatAction(chatId, "typing");

  try {
    const explanation = await generateAiExplanation(word);
    await editReviewMessage(chatId, messageId, formatAiExplanation(word, explanation), reviewResultKeyboard(word.id, currentIndex, total));
  } catch (error) {
    console.error("AI explanation failed", error);
    await editReviewMessage(
      chatId,
      messageId,
      formatAiExplanationError(word),
      reviewResultKeyboard(word.id, currentIndex, total)
    );
  }
}

async function startManualReview(chatId) {
  const words = await pickDueWords(REVIEW_LIMIT);

  if (words.length === 0) {
    await sendReviewMessage(chatId, "现在没有到期的词。你可以晚点再来，或者先去插件里同步一些新词。");
    return;
  }

  await sendPrompt(chatId, words[0], 1, words.length);
}

async function sendNextDueWord(chatId, previousWordId, nextIndex, total) {
  if (nextIndex > total) {
    await sendReviewMessage(chatId, `这一轮复习完成了。今天先这样。

想继续可以发送 /review。`);
    return;
  }

  const words = await pickDueWords(1, previousWordId);

  if (words.length === 0) {
    await sendReviewMessage(chatId, `这一轮复习完成了。今天先这样。

想继续可以发送 /review。`);
    return;
  }

  await sendPrompt(chatId, words[0], nextIndex, total);
}

async function sendPrompt(chatId, word, index, total) {
  await sendReviewMessage(chatId, formatPrompt(word, index, total), promptKeyboard(word.id, index, total));
}

async function pickDueWords(limit, excludeWordId = null) {
  const result = await query(
    `select id,
            original,
            translation,
            base_form,
            part_of_speech,
            article,
            plural,
            explanation,
            context_text,
            context_translation,
            review_count,
            difficulty,
            next_review_at,
            last_reviewed_at
     from words
     where (next_review_at is null or next_review_at <= now())
       and ($2::bigint is null or id <> $2::bigint)
     order by
       case when next_review_at is null then 0 else 1 end,
       difficulty desc,
       coalesce(next_review_at, created_at) asc,
       created_at asc
     limit $1`,
    [limit, excludeWordId]
  );

  return result.rows;
}

async function sendStats(chatId) {
  const result = await query(
    `select count(*)::int as total,
            count(*) filter (where next_review_at is null or next_review_at <= now())::int as due,
            coalesce(round(avg(difficulty), 1), 0) as avg_difficulty
     from words`
  );
  const stats = result.rows[0];
  await sendReviewMessage(
    chatId,
    `你的生词本：${stats.total} 个词\n今日到期：${stats.due} 个\n平均等级：${formatLevel(stats.avg_difficulty)}`
  );
}

function formatPrompt(word, index, total) {
  const safeTotal = Math.max(1, Number(total) || REVIEW_LIMIT);
  const safeIndex = Math.min(Math.max(1, Number(index) || 1), safeTotal);
  const lines = [
    `<b>复习 ${safeIndex}/${safeTotal}</b>`,
    "",
    `<b>${escapeHtml(word.original)}</b>`,
    "先别急着看答案，想一想：它在原句里是什么意思？"
  ];

  if (word.context_text) {
    lines.push("", `例句：${escapeHtml(shorten(word.context_text, 240))}`);
  }

  lines.push("", `<i>等级 ${formatLevel(word.difficulty)} · 已复习 ${word.review_count || 0} 次</i>`);
  return lines.join("\n");
}

function formatAnswer(word) {
  const meta = [
    word.article && `冠词：${word.article}`,
    word.plural && `复数：${word.plural}`,
    word.base_form && `原形：${word.base_form}`,
    word.part_of_speech && `词性：${word.part_of_speech}`
  ].filter(Boolean).join(" · ");

  const lines = [
    `<b>${escapeHtml(word.original)}</b>`,
    `<b>${escapeHtml(word.translation)}</b>`
  ];

  if (meta) {
    lines.push("", escapeHtml(meta));
  }

  if (word.explanation) {
    lines.push("", `解释：${escapeHtml(word.explanation)}`);
  }

  if (word.context_text) {
    lines.push("", `例句：${escapeHtml(shorten(word.context_text, 260))}`);
  }

  if (word.context_translation) {
    lines.push(escapeHtml(shorten(word.context_translation, 220)));
  }

  lines.push("", "你对这个词的感觉是？");
  return lines.join("\n");
}

function formatAiExplanation(word, explanation) {
  return [
    `<b>AI 讲讲：${escapeHtml(word.original)}</b>`,
    "",
    formatStructuredExplanation(explanation),
    "",
    "<i>现在给这个词打个复习结果：</i>"
  ].filter(Boolean).join("\n");
}

function formatStructuredExplanation(explanation) {
  const sections = parseExplanationSections(explanation);

  if (sections.length === 0) {
    return escapeHtml(shorten(explanation, 1800));
  }

  return sections
    .map(({ label, value }) => `<b>${escapeHtml(label)}：</b>${escapeHtml(value)}`)
    .join("\n\n");
}

function parseExplanationSections(explanation) {
  const labels = ["等级", "核心意思", "用法", "近义/搭配", "例句", "记忆提示"];
  const labelPattern = labels.join("|");
  const normalized = String(explanation || "")
    .replace(/\r/g, "")
    .replace(new RegExp(`\\s*(${labelPattern})[:：]`, "g"), "\n$1：")
    .trim();

  const sections = [];
  const pattern = new RegExp(`(${labelPattern})[:：]([\\s\\S]*?)(?=\\n(?:${labelPattern})[:：]|$)`, "g");
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    const label = match[1];
    const value = match[2].replace(/\s+/g, " ").trim();
    if (value) {
      sections.push({ label, value: shorten(value, 420) });
    }
  }

  return sections;
}

function formatAiExplanationError(word) {
  return [
    `<b>${escapeHtml(word.original)}</b>`,
    "",
    "AI 讲解暂时失败了。你可以先按当前感觉打分，主复习流程不受影响。",
    "",
    "<i>现在给这个词打个复习结果：</i>"
  ].join("\n");
}

function formatRecorded(word, action, updated) {
  const nextReview = formatDate(updated.next_review_at);
  return [
    `<b>${escapeHtml(word.original)}</b>`,
    `已记录：<b>${escapeHtml(resultLabel(action))}</b>`,
    `下次复习：${escapeHtml(nextReview)}`
  ].join("\n");
}

function promptKeyboard(wordId, index, total) {
  return [
    [{ text: "显示答案", callback_data: buildReviewCallback("show", wordId, index, total) }],
    [{ text: "跳过", callback_data: buildReviewCallback("unsure", wordId, index, total) }]
  ];
}

function resultKeyboard(wordId, index, total) {
  return [
    [{ text: "AI 讲讲", callback_data: buildReviewCallback("explain", wordId, index, total) }],
    ...reviewResultKeyboard(wordId, index, total)
  ];
}

function reviewResultKeyboard(wordId, index, total) {
  return [[
    { text: "认识", callback_data: buildReviewCallback("know", wordId, index, total) },
    { text: "模糊", callback_data: buildReviewCallback("unsure", wordId, index, total) },
    { text: "忘了", callback_data: buildReviewCallback("forgot", wordId, index, total) }
  ]];
}

function buildReviewCallback(action, wordId, index, total) {
  return `rv:${action}:${wordId}:${index}:${total}`;
}

function resultLabel(action) {
  return {
    know: "认识",
    unsure: "模糊",
    forgot: "忘了"
  }[action] || action;
}

async function sendReviewMessage(chatId, text, keyboard = null) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
  });
}

async function editReviewMessage(chatId, messageId, text, keyboard = null) {
  return telegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: keyboard || [] }
  });
}

async function sendChatAction(chatId, action) {
  return telegramApi("sendChatAction", {
    chat_id: chatId,
    action
  });
}

async function answerCallback(callbackQueryId, text, showAlert = false) {
  return telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert
  });
}

async function telegramApi(method, payload) {
  const token = getReviewBotToken();
  if (!token) {
    throw new Error("REVIEW_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN is required.");
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(async () => ({
    ok: false,
    description: await response.text()
  }));

  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

function isFatalTelegramError(error) {
  const message = String(error?.message || "");
  return message.includes('"error_code":401') || message.includes('"error_code":404');
}

function getReviewBotToken() {
  return process.env.REVIEW_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
}

function getReviewChatId() {
  return process.env.REVIEW_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
}

function formatLevel(value) {
  const difficulty = Math.round(Number(value) || 2);
  const levels = {
    1: "A1 入门",
    2: "A2 基础",
    3: "B1 中级",
    4: "B2 中高级",
    5: "C1 高级"
  };
  return levels[Math.min(5, Math.max(1, difficulty))];
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

function shorten(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
