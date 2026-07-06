import cron from "node-cron";
import { sendDailyReview } from "../telegram/reviewBot.js";

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

export { sendDailyReview };
