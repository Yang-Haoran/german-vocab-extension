const wordList = document.querySelector("#wordList");
const count = document.querySelector("#count");
const search = document.querySelector("#search");
let words = [];

loadWords();

search.addEventListener("input", renderWords);
document.querySelector("#openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function loadWords() {
  const result = await chrome.storage.local.get("words");
  words = result.words || [];
  renderWords();
}

function renderWords() {
  const query = search.value.trim().toLocaleLowerCase();
  const filtered = words.filter((word) => {
    const searchable = [
      word.original,
      word.translation,
      word.baseForm,
      word.explanation,
      word.context,
      word.contextTranslation
    ].join(" ").toLocaleLowerCase();
    return searchable.includes(query);
  });

  count.textContent = query
    ? `找到 ${filtered.length} 个词条，共收藏 ${words.length} 个`
    : `共 ${words.length} 个词条`;

  if (filtered.length === 0) {
    wordList.innerHTML = `
      <div class="empty">
        ${query ? "没有找到匹配的词条。" : "还没有收藏词条。去网页中选中一段德语试试吧。"}
      </div>
    `;
    return;
  }

  wordList.innerHTML = "";
  filtered.forEach((word) => wordList.append(createWordCard(word)));
}

function createWordCard(word) {
  const details = [
    word.article && `冠词：${word.article}`,
    word.plural && `复数：${word.plural}`,
    word.baseForm && `原形：${word.baseForm}`,
    word.partOfSpeech && `词性：${word.partOfSpeech}`
  ].filter(Boolean);

  const card = document.createElement("article");
  card.className = "word-card";
  card.innerHTML = `
    <header>
      <div>
        <div class="word-title">
          <h2>${escapeHtml(word.original)}</h2>
          <button
            type="button"
            class="speak-button"
            data-speak
            title="朗读德语"
            aria-label="朗读德语"
          >🔊</button>
        </div>
        <div class="translation">${escapeHtml(word.translation)}</div>
      </div>
      <button type="button" class="danger" data-delete>删除</button>
    </header>
    ${details.length ? `<div class="meta">${details.map(escapeHtml).join(" · ")}</div>` : ""}
    ${word.explanation ? `<div class="explanation">${escapeHtml(word.explanation)}</div>` : ""}
    ${word.context ? `<div class="context"><strong>例句：</strong>${escapeHtml(word.context)}</div>` : ""}
    ${word.contextTranslation ? `<div class="context">${escapeHtml(word.contextTranslation)}</div>` : ""}
    ${word.sourceUrl ? `<a href="${escapeHtml(word.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(word.sourceTitle || "查看来源")}</a>` : ""}
  `;

  card.querySelector("[data-speak]").addEventListener("click", async () => {
    const spoken = await speakGerman(word.original);
    if (!spoken) {
      window.alert("未找到德语语音，请在插件设置中选择德语声音。");
    }
  });

  card.querySelector("[data-delete]").addEventListener("click", async () => {
    words = words.filter((item) => item.id !== word.id);
    await chrome.storage.local.set({ words });
    renderWords();
  });

  return card;
}

async function speakGerman(text) {
  speechSynthesis.cancel();
  const voices = await loadVoices();
  const { germanVoiceURI } = await chrome.storage.local.get("germanVoiceURI");
  const germanVoice =
    voices.find((voice) => voice.voiceURI === germanVoiceURI) ||
    voices.find((voice) => voice.lang.toLocaleLowerCase() === "de-de") ||
    voices.find((voice) => voice.lang.toLocaleLowerCase().startsWith("de"));

  if (!germanVoice) {
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = germanVoice;
  utterance.lang = germanVoice.lang;
  utterance.rate = 0.85;
  speechSynthesis.speak(utterance);
  return true;
}

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    return Promise.resolve(voices);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(speechSynthesis.getVoices()), 1000);
    speechSynthesis.addEventListener("voiceschanged", () => {
      clearTimeout(timeout);
      resolve(speechSynthesis.getVoices());
    }, { once: true });
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
