import "dotenv/config";
import cors from "cors";
import express from "express";
import { wordsRouter } from "./routes/words.js";
import { startDailyReviewJob } from "./scheduler/dailyReview.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "german-vocab-server" });
});

app.use("/api/words", wordsRouter);

startDailyReviewJob();

app.listen(port, () => {
  console.log(`German vocab server listening on port ${port}`);
});
