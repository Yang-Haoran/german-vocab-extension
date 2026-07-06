import cron from "node-cron";
import { query } from "../db.js";
import { sendTelegramMessage } from "../telegram/bot.js";
import { createReviewUrl } from "../routes/reviews.js";

const REVIEW_LIMIT = 5;

export function startDailyReviewJob() {
  const schedule = process.env.DAILY_REVIEW_CRON || "0 9 * * *";
  const timezone = process.env.DAILY_REVIEW_TIMEZONE || "Europe/Berlin";

  cron.schedule(schedule, async () => {
    try {
      await sendDailyReview();
    } catch (error) {
      console.error("Daily review job failed", error);
    }
  }, { timezone });
}

export async function sendDailyReview() {
  const words = await pickReviewWords();

  if (words.length === 0) {
    await sendTelegramMessage("今天还没有可复习的德语单词。先去读一篇文章，攒一点材料吧。");
    return { sent: 0 };
  }

  await sendTelegramMessage(`今日德语复习：${words.length} 个词

先看词和例句，尽量自己回忆意思，再点“显示答案”。`);

  for (const [index, word] of words.entries()) {
    await sendReviewCard(word, index + 1, words.length);
  }

  return { sent: words.length };
}

async function pickReviewWords() {
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
     where next_review_at is null or next_review_at <= now()
     order by
       case when next_review_at is null then 0 else 1 end,
       difficulty desc,
       coalesce(next_review_at, created_at) asc,
       created_at asc
     limit $1`,
    [REVIEW_LIMIT]
  );

  return result.rows;
}

async function sendReviewCard(word, index, total) {
  const text = formatReviewPrompt(word, index, total);
  await sendTelegramMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "显示答案", url: createReviewUrl(word.id, "show") }
        ],
        [
          { text: "认识", url: createReviewUrl(word.id, "know") },
          { text: "模糊", url: createReviewUrl(word.id, "unsure") },
          { text: "不认识", url: createReviewUrl(word.id, "forgot") }
        ]
      ]
    }
  });
}

function formatReviewPrompt(word, index, total) {
  const lines = [
    `<b>今日复习 ${index}/${total}</b>`,
    "",
    `<b>${escapeHtml(word.original)}</b>`,
    "先想一想：这个词在原句里是什么意思？"
  ];

  if (word.context_text) {
    lines.push("", `例句：${escapeHtml(shorten(word.context_text, 260))}`);
  }

  const reviewInfo = [
    `难度 ${word.difficulty || 2}/5`,
    `已复习 ${word.review_count || 0} 次`
  ].join(" · ");

  lines.push("", `<i>${escapeHtml(reviewInfo)}</i>`);
  return lines.join("\n");
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
