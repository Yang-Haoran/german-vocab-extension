// "/heute" daily lesson: review up to 5 cards → pick one of three real articles → read a short B2 version
// → answer a question in German → get corrections. Mistakes and keywords become future review cards.
// Nothing is pushed on a schedule; the learner starts it.
import { fetchArticleText, pickCandidates } from "../learning/articles.js";
import { correctWriting } from "../learning/correct.js";
import { createLesson } from "../learning/lesson.js";
import {
  addCards, findLesson, getState, learningStats, lessonCards, markLessonAnswered, saveLesson, saveWriting, setState,
  usedArticleUrls, writingCards
} from "../learning/store.js";
import { answerCallback, editReviewMessage, escapeHtml, sendChatAction, sendReviewMessage, startReviewRound } from "./reviewBot.js";

const SESSION = "session";
const DAILY_REVIEW = 5;
const MAX_WRITING = 1500;

export async function startHeute(chatId) {
  await setState(SESSION, { stage: "review", reviewed: 0, shownUrls: [] });
  const count = await startReviewRound(chatId, DAILY_REVIEW, (n) => `🔁 <b>今日一课</b>\n先热身：复习 ${n} 个，看句子想出挖掉的词。`);

  if (count === 0) {
    await offerArticles(chatId, "📖 <b>今日一课</b>\n今天没有要复习的词，直接挑一篇读：");
  }
}

// Called by the review flow when a round ends. Returns true when the lesson takes over.
export async function onReviewRoundDone(chatId, reviewed) {
  const session = await getState(SESSION);
  if (session?.stage !== "review") {
    return false;
  }
  await offerArticles(chatId, `✅ 复习完 ${reviewed} 个。现在挑一篇读：`, { ...session, reviewed });
  return true;
}

export async function handleCoachCallback(callback) {
  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;
  const [, action, arg] = String(callback.data).split(":");
  const session = (await getState(SESSION)) || {};

  if (action === "pick") {
    const article = session.stage === "choose" ? session.candidates?.[Number(arg)] : null;
    if (!article) {
      await answerCallback(callback.id, "这个选择已经过期了，发 /heute 重新开始。", true);
      return;
    }
    await answerCallback(callback.id, "正在准备这篇……");
    await editReviewMessage(chatId, messageId, `📖 你选了：<b>${escapeHtml(article.title)}</b>\n<i>正在准备，大约半分钟……</i>`, []);
    await prepareLesson(chatId, article, session);
    return;
  }

  if (action === "more") {
    await answerCallback(callback.id, "换一批");
    await editReviewMessage(chatId, messageId, "🔄 换一批……", []);
    await offerArticles(chatId, "换了一批，挑一篇：", session);
    return;
  }

  if (action === "stop") {
    await answerCallback(callback.id, "好");
    await setState(SESSION, { ...session, stage: "done" });
    await editReviewMessage(chatId, messageId, "好，今天就到这。想读的时候发 /heute。", []);
    return;
  }

  await answerCallback(callback.id, "这个按钮已经失效了。", true);
}

// Free text from the learner: the answer to today's question, or any German text to correct.
export async function handleCoachText(chatId, text) {
  if (text.length > MAX_WRITING) {
    await sendReviewMessage(chatId, `有点长（${text.length} 字），分成几段发，每段 ${MAX_WRITING} 字以内。`);
    return;
  }

  const session = (await getState(SESSION)) || {};
  const lesson = session.stage === "writing" && session.lessonId ? await findLesson(session.lessonId) : null;

  await sendReviewMessage(chatId, "<i>收到，正在批改，大约一分钟……</i>");
  await sendChatAction(chatId, "typing");
  let correction;
  try {
    correction = await correctWriting(text, lesson ? { question: lesson.question_de, context: lesson.text_de } : {});
  } catch (error) {
    console.error("Correction failed", error);
    await sendReviewMessage(chatId, "批改暂时失败了（AI 服务繁忙），过几分钟把这段再发一次。");
    return;
  }

  if (!correction.isGerman) {
    await sendReviewMessage(chatId, escapeHtml(correction.praise || "用德语写哦，写错了也没关系。"));
    return;
  }

  const writingId = await saveWriting(lesson?.id || null, text, correction);
  const added = await addCards(writingCards(writingId, correction));
  await sendReviewMessage(chatId, formatCorrection(correction, added));

  if (lesson) {
    await markLessonAnswered(lesson.id);
    await setState(SESSION, { ...session, stage: "done" });
    await sendReviewMessage(chatId, await formatDone(session));
  }
}

export async function skipWriting(chatId) {
  const session = (await getState(SESSION)) || {};
  if (session.stage !== "writing") {
    await sendReviewMessage(chatId, "现在没有要写的题。发 /heute 开始今日一课。");
    return;
  }
  await setState(SESSION, { ...session, stage: "done" });
  await sendReviewMessage(chatId, `好，这次不写了。\n\n${await formatDone(session, false)}`);
}

async function offerArticles(chatId, intro, session = {}) {
  await sendChatAction(chatId, "typing");
  const exclude = new Set([...(await usedArticleUrls()), ...(session.shownUrls || [])]);
  const candidates = await pickCandidates(exclude);

  if (!candidates.length) {
    await setState(SESSION, { ...session, stage: "done" });
    await sendReviewMessage(chatId, "现在拿不到文章（新闻源都没响应），过一会儿再发 /heute。");
    return;
  }

  await setState(SESSION, {
    ...session,
    stage: "choose",
    candidates,
    shownUrls: [...(session.shownUrls || []), ...candidates.map((item) => item.url)]
  });

  const lines = [intro, ""];
  candidates.forEach((item, index) => {
    lines.push(`<b>${index + 1}.</b> ${escapeHtml(item.categoryLabel)} · <i>${escapeHtml(item.source)}</i>\n${escapeHtml(item.title)}`, "");
  });

  await sendReviewMessage(chatId, lines.join("\n").trim(), [
    candidates.map((_, index) => ({ text: String(index + 1), callback_data: `co:pick:${index}` })),
    [{ text: "🔄 换一批", callback_data: "co:more" }, { text: "今天不读了", callback_data: "co:stop" }]
  ]);
}

async function prepareLesson(chatId, article, session) {
  await sendChatAction(chatId, "typing");
  let lesson;
  try {
    const text = await fetchArticleText(article.url, article.summary);
    lesson = await createLesson(article, text || article.summary || article.title);
    if (!lesson.text_de || !lesson.question_de) {
      throw new Error("lesson is incomplete");
    }
  } catch (error) {
    console.error("Lesson failed", error);
    await sendReviewMessage(chatId, "这篇没准备好（AI 服务繁忙或文章读不到），换一篇试试：", [
      session.candidates.map((_, index) => ({ text: String(index + 1), callback_data: `co:pick:${index}` })),
      [{ text: "🔄 换一批", callback_data: "co:more" }]
    ]);
    return;
  }

  const lessonId = await saveLesson(article, lesson);
  await addCards(lessonCards(lessonId, article, lesson));
  await setState(SESSION, { ...session, stage: "writing", lessonId });
  await sendReviewMessage(chatId, formatLesson(article, lesson));
  await sendReviewMessage(chatId, [
    "✍️ <b>用 2～4 句德语回答</b>（直接发给我，写错了没关系）",
    "",
    escapeHtml(lesson.question_de),
    `<tg-spoiler>${escapeHtml(lesson.question_zh)}</tg-spoiler>`,
    "",
    "<i>不想写就发 /skip</i>"
  ].join("\n"));
}

function formatLesson(article, lesson) {
  const lines = [
    `📖 <b>${escapeHtml(lesson.title_de || article.title)}</b>`,
    `<i>${escapeHtml(article.categoryLabel)} · ${escapeHtml(article.source)}</i>`,
    "",
    escapeHtml(lesson.text_de),
    "",
    "🇨🇳 中文（点开看）",
    `<tg-spoiler>${escapeHtml(lesson.text_zh)}</tg-spoiler>`
  ];

  if (lesson.keywords.length) {
    lines.push("", "🔑 <b>关键词</b>（已加进复习，明天开始出填空题）");
    for (const keyword of lesson.keywords) {
      const head = [keyword.article, keyword.lemma || keyword.word].filter(Boolean).join(" ") + (keyword.plural ? `, ${keyword.plural}` : "");
      const inText = keyword.lemma && keyword.lemma.replace("|", "") !== keyword.word ? `（文中：${keyword.word}）` : "";
      lines.push(`• <b>${escapeHtml(head)}</b>${escapeHtml(inText)} — ${escapeHtml(keyword.zh)}`);
    }
  }

  lines.push("", `<a href="${escapeHtml(article.url)}">读原文</a>`);
  return lines.join("\n");
}

function formatCorrection(correction, added) {
  const lines = ["✍️ <b>批改</b>"];

  if (correction.praise) {
    lines.push(escapeHtml(correction.praise));
  }

  if (!correction.errors.length) {
    lines.push("", "没发现错误 👍");
  } else {
    lines.push("", "<b>改好的版本</b>", escapeHtml(correction.corrected), "", "<b>错在哪</b>");
    correction.errors.forEach((error, index) => {
      lines.push(`${index + 1}. <s>${escapeHtml(error.wrong)}</s> → <b>${escapeHtml(error.right)}</b>（${escapeHtml(error.type)}）`);
      if (error.explain_zh) {
        lines.push(`    ${escapeHtml(error.explain_zh)}`);
      }
    });
  }

  if (correction.better) {
    lines.push("", "💡 <b>更地道的说法</b>", escapeHtml(correction.better));
  }

  if (added) {
    lines.push("", `📌 ${added} 处加进了复习，明天开始以填空题出现。`);
  }

  return lines.join("\n");
}

async function formatDone(session, wrote = true) {
  const stats = await learningStats();
  const parts = [session.reviewed ? `复习 ${session.reviewed} 个` : null, "读 1 篇", wrote ? "写 1 段" : null].filter(Boolean);
  return `🎉 今天完成：${parts.join(" · ")}\n最近 7 天练了 ${stats.days_7} 天。明天见，发 /heute 就行。`;
}
