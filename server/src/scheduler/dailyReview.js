import cron from "node-cron";
import { getState, setState } from "../learning/store.js";
import { sendDailyReview, sendReviewMessage } from "../telegram/reviewBot.js";

const INACTIVE_HOURS = 48;

export function startDailyReviewJob() {
  const timezone = process.env.DAILY_REVIEW_TIMEZONE || "Europe/Berlin";

  // The old 9:00 review push is off by default: the learner starts /heute when they want.
  if (process.env.DAILY_REVIEW_ENABLED === "true") {
    cron.schedule(process.env.DAILY_REVIEW_CRON || "0 9 * * *", () => {
      sendDailyReview().catch((error) => console.error("Daily review job failed", error));
    }, { timezone });
  }

  // One gentle reminder after two days without any activity, then quiet until the next activity.
  if (process.env.NUDGE_ENABLED !== "false") {
    cron.schedule(process.env.NUDGE_CRON || "0 19 * * *", () => {
      nudgeIfInactive().catch((error) => console.error("Nudge job failed", error));
    }, { timezone });
  }
}

export async function nudgeIfInactive(now = Date.now()) {
  const chatId = process.env.REVIEW_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  const last = Date.parse((await getState("last_activity"))?.at || "") || 0;
  const nudged = Date.parse((await getState("nudged_at"))?.at || "") || 0;

  if (!chatId || !last || now - last < INACTIVE_HOURS * 3_600_000 || nudged > last) {
    return false;
  }

  await sendReviewMessage(chatId, "两天没练德语了。发 /heute，10 分钟就好：复习 5 个、读一篇、写几句。");
  await setState("nudged_at", { at: new Date(now).toISOString() });
  return true;
}

export { sendDailyReview };
