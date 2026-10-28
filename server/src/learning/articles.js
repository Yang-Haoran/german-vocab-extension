// Real German articles for the daily lesson: one candidate per category from RSS feeds,
// then the article text is fetched from the page (falls back to the RSS summary).
import Parser from "rss-parser";

const USER_AGENT = "Mozilla/5.0 (compatible; deutsch-vocab-coach/1.0)";
const MAX_AGE_DAYS = 4;
const FEED_CACHE_MS = 60 * 60 * 1000;
const MAX_ARTICLE_CHARS = 5000;

// All feeds checked on 2026-10-28. BNN (Karlsruhe) has a feed but the article text is not readable, so it is left out.
export const CATEGORIES = [
  {
    key: "it",
    label: "💻 IT & Technik",
    feeds: [
      { source: "heise", url: "https://www.heise.de/rss/heise-atom.xml" },
      { source: "golem", url: "https://rss.golem.de/rss.php?feed=RSS2.0" },
      { source: "t3n", url: "https://t3n.de/rss.xml" }
    ]
  },
  {
    key: "arbeit",
    label: "💼 Arbeit & Ausbildung",
    feeds: [
      { source: "ZEIT Arbeit", url: "https://newsfeed.zeit.de/arbeit/index" },
      { source: "SPIEGEL Job & Karriere", url: "https://www.spiegel.de/karriere/index.rss" },
      { source: "tagesschau Wirtschaft", url: "https://www.tagesschau.de/wirtschaft/index~rss2.xml" }
    ]
  },
  {
    key: "region",
    label: "🏙 Karlsruhe & Deutschland",
    feeds: [
      { source: "SWR Karlsruhe", url: "https://www.swr.de/~rss/swraktuell/baden-wuerttemberg/karlsruhe/index.xml", prefer: true },
      { source: "SWR Baden-Württemberg", url: "https://www.swr.de/~rss/swraktuell/baden-wuerttemberg/index.xml" },
      { source: "tagesschau Inland", url: "https://www.tagesschau.de/inland/index~rss2.xml" }
    ]
  }
];

// Paywalled, live-ticker or non-article entries are skipped.
const SKIP_TITLE = /heise\+|\bS\+|\bZ\+|Podcast|Liveblog|Ticker|Quiz|Anzeige|Gewinnspiel|^\s*\+\+|\+\+\s*$/i;
const SKIP_URL = /liveblog|newsticker|\/ticker|\/podcast/i;
const TRACKING_PARAM = /^(utm_|wt_mc$|wt_zmc$|at_medium$|at_campaign$)/;

const parser = new Parser();
const feedCache = new Map();

export async function pickCandidates(excludeUrls = new Set(), now = Date.now()) {
  const picks = [];

  for (const category of CATEGORIES) {
    const items = [];
    for (const feed of category.feeds) {
      try {
        items.push(...(await readFeed(feed, now)));
      } catch (error) {
        console.error(`Feed failed: ${feed.url}`, error.message);
      }
    }

    const recent = items
      .filter((item) => !excludeUrls.has(item.url) && now - item.published <= MAX_AGE_DAYS * 86_400_000)
      .sort((a, b) => b.published - a.published);
    // A feed marked "prefer" (Karlsruhe) wins whenever it has something new.
    const preferred = recent.filter((item) => item.prefer);
    const fresh = (preferred.length ? preferred : recent).slice(0, 12);

    if (fresh.length) {
      const item = fresh[Math.floor(Math.random() * fresh.length)];
      picks.push({ ...item, category: category.key, categoryLabel: category.label });
    }
  }

  return picks;
}

async function readFeed(feed, now) {
  const cached = feedCache.get(feed.url);
  if (cached && now - cached.at < FEED_CACHE_MS) {
    return cached.items;
  }

  const xml = await fetchText(feed.url);
  const parsed = await parser.parseString(xml);
  const items = (parsed.items || [])
    .map((item) => ({
      source: feed.source,
      prefer: Boolean(feed.prefer),
      title: clean(item.title),
      url: stripTracking(String(item.link || "").trim()),
      summary: clean(item.contentSnippet || item.summary || item.content || ""),
      published: Date.parse(item.isoDate || item.pubDate || "") || 0
    }))
    .filter((item) => item.title && item.url && !SKIP_TITLE.test(item.title) && !SKIP_URL.test(item.url));

  feedCache.set(feed.url, { at: now, items });
  return items;
}

export async function fetchArticleText(url, fallback = "") {
  try {
    const text = extractParagraphs(await fetchText(url));
    if (text.length >= 400) {
      return text.slice(0, MAX_ARTICLE_CHARS);
    }
  } catch (error) {
    console.error(`Article fetch failed: ${url}`, error.message);
  }
  return fallback;
}

// Keeps the readable body paragraphs of a news page (no layout parser needed for these sites).
export function extractParagraphs(html) {
  const body = String(html || "")
    .replace(/<(script|style|noscript|svg|figure|figcaption|nav|footer|header|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  const paragraphs = [];

  for (const match of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = clean(match[1]);
    if (text.length >= 60 && !/cookie|newsletter|abonn|anzeige|javascript|werbung|©/i.test(text)) {
      paragraphs.push(text);
    }
  }

  return [...new Set(paragraphs)].join("\n\n");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // golem.de still serves ISO-8859-1; decode with the charset the server declares.
  const charset = /charset=([\w-]+)/i.exec(response.headers.get("content-type") || "")?.[1] || "utf-8";
  const buffer = await response.arrayBuffer();
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

export function stripTracking(url) {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function clean(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "", auml: "ä", ouml: "ö", uuml: "ü",
    Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", euro: "€", ndash: "–", mdash: "—", bdquo: "„", ldquo: "“", rdquo: "”",
    lsquo: "‘", rsquo: "’", hellip: "…" };
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name] ?? entity);
}
