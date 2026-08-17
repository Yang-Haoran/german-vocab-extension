import { Router } from "express";
import { requireApiSecret } from "../auth.js";
import { query } from "../db.js";

export const wordsRouter = Router();

wordsRouter.use(requireApiSecret);

wordsRouter.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const result = await query(
      `select *
       from words
       order by created_at desc
       limit $1`,
      [limit]
    );

    res.json({ words: result.rows });
  } catch (error) {
    next(error);
  }
});

wordsRouter.post("/", async (req, res, next) => {
  try {
    const word = normalizeWord(req.body);

    if (!word.original || !word.translation) {
      return res.status(400).json({ error: "original and translation are required." });
    }

    const result = await query(
      `insert into words (
         original,
         translation,
         base_form,
         part_of_speech,
         cefr_level,
         article,
         plural,
         explanation,
         context_text,
         context_translation,
         source_title,
         source_url
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (original, source_url) do update set
         translation = excluded.translation,
         base_form = excluded.base_form,
         part_of_speech = excluded.part_of_speech,
         cefr_level = excluded.cefr_level,
         article = excluded.article,
         plural = excluded.plural,
         explanation = excluded.explanation,
         context_text = excluded.context_text,
         context_translation = excluded.context_translation,
         source_title = excluded.source_title,
         updated_at = now()
       returning *`,
      [
        word.original,
        word.translation,
        word.baseForm,
        word.partOfSpeech,
        word.cefrLevel,
        word.article,
        word.plural,
        word.explanation,
        word.contextText,
        word.contextTranslation,
        word.sourceTitle,
        word.sourceUrl
      ]
    );

    res.status(201).json({ word: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

wordsRouter.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

function normalizeWord(input) {
  return {
    original: clean(input.original),
    translation: clean(input.translation),
    baseForm: clean(input.baseForm || input.base_form),
    partOfSpeech: clean(input.partOfSpeech || input.part_of_speech),
    cefrLevel: normalizeCefrLevel(input.cefrLevel || input.cefr_level),
    article: clean(input.article),
    plural: clean(input.plural),
    explanation: clean(input.explanation),
    contextText: clean(input.contextText || input.context || input.exampleSentence),
    contextTranslation: clean(input.contextTranslation || input.context_translation),
    sourceTitle: clean(input.sourceTitle || input.title),
    sourceUrl: clean(input.sourceUrl || input.url)
  };
}

function normalizeCefrLevel(value) {
  const normalized = clean(value).toUpperCase();
  return ["A1", "A2", "B1", "B2", "C1"].includes(normalized) ? normalized : "";
}

function clean(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}
