// Database helpers for the daily lesson: bot state, lessons, writings and generated review cards.
import { query } from "../db.js";
import { GRADUATED_STAGE } from "./srs.js";

const TIMEZONE = process.env.DAILY_REVIEW_TIMEZONE || "Europe/Berlin";

export async function getState(key) {
  const result = await query("select value from bot_state where key = $1", [key]);
  return result.rows[0]?.value ?? null;
}

export async function setState(key, value) {
  await query(
    `insert into bot_state (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
}

export async function saveLesson(article, lesson) {
  const result = await query(
    `insert into lessons (category, source, url, title, text_de, text_zh, question_de, question_zh, keywords)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [article.category, article.source, article.url, lesson.title_de || article.title, lesson.text_de, lesson.text_zh,
      lesson.question_de, lesson.question_zh, JSON.stringify(lesson.keywords)]
  );
  return result.rows[0].id;
}

export async function findLesson(id) {
  const result = await query("select * from lessons where id = $1", [id]);
  return result.rows[0] || null;
}

export async function markLessonAnswered(id) {
  await query("update lessons set answered_at = now() where id = $1", [id]);
}

export async function usedArticleUrls(days = 90) {
  const result = await query(
    "select url from lessons where created_at > now() - ($1::text || ' days')::interval",
    [days]
  );
  return new Set(result.rows.map((row) => row.url));
}

export async function saveWriting(lessonId, text, correction) {
  const result = await query(
    `insert into writings (lesson_id, text, corrected, better, errors)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [lessonId, text, correction.corrected, correction.better, JSON.stringify(correction.errors)]
  );
  return result.rows[0].id;
}

// New cards are due tomorrow. Existing (original, source_url) pairs are left untouched.
export async function addCards(cards) {
  let added = 0;

  for (const card of cards) {
    const result = await query(
      `insert into words (original, translation, base_form, article, plural, explanation, context_text,
                          source_title, source_url, origin, mistake, next_review_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now() + interval '1 day')
       on conflict (original, source_url) do nothing`,
      [card.original, card.translation || "", card.baseForm || "", card.article || "", card.plural || "",
        card.explanation || "", card.context || "", card.sourceTitle || "", card.sourceUrl, card.origin, card.mistake || ""]
    );
    added += result.rowCount;
  }

  return added;
}

export function lessonCards(lessonId, article, lesson) {
  return lesson.keywords.map((keyword) => ({
    original: keyword.word,
    translation: keyword.zh,
    baseForm: keyword.lemma,
    article: keyword.article,
    plural: keyword.plural,
    context: keyword.sentence,
    sourceTitle: lesson.title_de || article.title,
    sourceUrl: article.url || `lesson:${lessonId}`,
    origin: "lesson"
  }));
}

export function writingCards(writingId, correction) {
  return correction.errors
    .filter((error) => error.card)
    .map((error) => ({
      original: error.right,
      translation: error.explain_zh,
      explanation: `你写的：${error.wrong}（${error.type}）`,
      context: error.sentence,
      sourceTitle: "我的写作",
      sourceUrl: `writing:${writingId}`,
      origin: "writing",
      mistake: error.wrong
    }));
}

export async function learningStats() {
  const result = await query(
    `select
       (select count(*) from words where deleted_at is null)::int as words,
       (select count(*) from words where deleted_at is null
          and (next_review_at is null or next_review_at <= now()))::int as due,
       (select count(*) from words where deleted_at is null and stage >= $1)::int as graduated,
       (select count(*) from lessons)::int as lessons,
       (select count(*) from writings)::int as writings,
       (select count(distinct (created_at at time zone $2)::date) from lessons
          where created_at > now() - interval '7 days')::int as days_7`,
    [GRADUATED_STAGE, TIMEZONE]
  );
  const errorTypes = await query(
    `select e->>'type' as type, count(*)::int as count
     from writings, jsonb_array_elements(errors) e
     where created_at > now() - interval '30 days'
     group by 1 order by 2 desc limit 3`
  );
  return { ...result.rows[0], topErrors: errorTypes.rows };
}
