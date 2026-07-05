import cron from "node-cron";
import { query } from "../db.js";
import { sendTelegramMessage } from "../telegram/bot.js";

export function startDailyReviewJob() {
  const schedule = process.env.DAILY_REVIEW_CRON || "0 9 * * *";

  cron.schedule(schedule, async () => {
    try {
      const words = await pickReviewWords();

      if (words.length === 0) {
        await sendTelegramMessage("今天还没有可复习的德语单词。先去读一篇文章，攒一点材料吧。");
        return;
      }

      await sendTelegramMessage(formatDailyReview(words));
      await markWordsReviewed(words);
    } catch (error) {
      console.error("Daily review job failed", error);
    }
  });
}

async function pickReviewWords() {
  const result = await query(
    `select id, original, translation, base_form, article, plural, explanation, context_text
     from words
     order by coalesce(reviewed_at, created_at) asc
     limit 5`
  );

  return result.rows;
}

async function markWordsReviewed(words) {
  const ids = words.map((word) => word.id);

  if (ids.length === 0) {
    return;
  }

  await query(
    `update words
     set reviewed_at = now(), updated_at = now()
     where id = any($1::bigint[])`,
    [ids]
  );
}

function formatDailyReview(words) {
  const lines = ["今日德语复习", ""];

  words.forEach((word, index) => {
    const meta = [word.article, word.base_form, word.plural].filter(Boolean).join(" · ");
    lines.push(`${index + 1}. <b>${escapeHtml(word.original)}</b> - ${escapeHtml(word.translation)}`);

    if (meta) {
      lines.push(`   ${escapeHtml(meta)}`);
    }

    if (word.context_text) {
      lines.push(`   例句：${escapeHtml(word.context_text)}`);
    }
  });

  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
