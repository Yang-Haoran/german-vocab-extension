const wordList = document.querySelector("#wordList");
const count = document.querySelector("#count");
const search = document.querySelector("#search");
const syncCloudButton = document.querySelector("#syncCloud");
const syncStatus = document.querySelector("#syncStatus");
let words = [];

loadWords();

search.addEventListener("input", renderWords);
syncCloudButton.addEventListener("click", syncWordsToCloud);
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
    word.partOfSpeech && `词性：${word.partOfSpeech}`,
    word.cefrLevel && `等级：${word.cefrLevel}`
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
    <div class="sync-badge ${word.cloudSyncedAt ? "synced" : "pending"}">
      ${word.cloudSyncedAt ? `已同步：${escapeHtml(formatDateTime(word.cloudSyncedAt))}` : "未同步到云端"}
    </div>
    ${word.sourceUrl ? `<a href="${escapeHtml(word.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(word.sourceTitle || "查看来源")}</a>` : ""}
  `;

  card.querySelector("[data-speak]").addEventListener("click", async () => {
    const spoken = await speakGerman(word.original);
    if (!spoken) {
      window.alert("未找到德语语音，请在插件设置中选择德语声音。");
    }
  });

  card.querySelector("[data-delete]").addEventListener("click", async () => {
    await deleteWord(word);
  });

  return card;
}


async function deleteWord(word) {
  const confirmed = window.confirm(`确定删除「${word.original}」吗？${word.cloudSyncedAt ? "\n\n这个词也会从云端生词本删除。" : ""}`);
  if (!confirmed) {
    return;
  }

  if (word.cloudSyncedAt) {
    const settings = await chrome.storage.local.get([
      "cloudSyncEnabled",
      "cloudApiBaseUrl",
      "cloudApiSecret"
    ]);

    if (!settings.cloudSyncEnabled || !settings.cloudApiBaseUrl || !settings.cloudApiSecret) {
      window.alert("这个词已经同步到云端。请先到 API 设置里确认云端同步配置，然后再删除，避免本地和云端不一致。");
      return;
    }

    try {
      await ensureCloudPermission(settings.cloudApiBaseUrl);
      await deleteWordFromCloud(word, settings);
    } catch (error) {
      console.error("Cloud delete failed", word.original, error);
      window.alert("云端删除失败，本地暂时没有删除。请稍后重试。");
      return;
    }
  }

  words = words.filter((item) => item.id !== word.id);
  await chrome.storage.local.set({ words });
  renderWords();
  setSyncStatus(word.cloudSyncedAt ? "已从本地和云端删除。" : "已从本地删除。", "success");
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



async function syncWordsToCloud() {
  if (words.length === 0) {
    setSyncStatus("本地单词本还是空的，暂时没有可同步的词。", "");
    return;
  }

  const settings = await chrome.storage.local.get([
    "cloudSyncEnabled",
    "cloudApiBaseUrl",
    "cloudApiSecret"
  ]);

  if (!settings.cloudSyncEnabled || !settings.cloudApiBaseUrl || !settings.cloudApiSecret) {
    setSyncStatus("请先到 API 设置里启用云端同步，并填写云端 API 地址和 API Secret。", "error");
    return;
  }

  try {
    const granted = await ensureCloudPermission(settings.cloudApiBaseUrl);
    if (!granted) {
      setSyncStatus("未获得云端 API 地址的访问权限，无法同步。", "error");
      return;
    }
  } catch {
    setSyncStatus("云端 API 地址无效，请在设置中填写完整的 HTTP 或 HTTPS 地址。", "error");
    return;
  }

  const unsyncedWords = words.filter((word) => !word.cloudSyncedAt);
  if (unsyncedWords.length === 0) {
    setSyncStatus("所有本地词条都已经同步到云端。", "success");
    return;
  }

  syncCloudButton.disabled = true;
  setSyncStatus(`正在同步 ${unsyncedWords.length} 个词条...`, "");

  let successCount = 0;
  let failedCount = 0;
  const syncedAt = new Date().toISOString();

  for (const word of unsyncedWords) {
    try {
      const cloudWord = await uploadWordToCloud(word, settings);
      if (cloudWord?.id) {
        word.cloudId = cloudWord.id;
      }
      word.cloudSyncedAt = syncedAt;
      successCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error("Cloud sync failed", word.original, error);
    }
  }

  await chrome.storage.local.set({ words });
  renderWords();
  syncCloudButton.disabled = false;

  if (failedCount === 0) {
    setSyncStatus(`同步完成：${successCount} 个词条已上传到云端。`, "success");
  } else {
    setSyncStatus(`部分同步失败：成功 ${successCount} 个，失败 ${failedCount} 个。稍后可以再点一次同步。`, "error");
  }
}

async function uploadWordToCloud(word, settings) {
  const baseUrl = String(settings.cloudApiBaseUrl || "").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/api/words`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-secret": settings.cloudApiSecret
    },
    body: JSON.stringify(toCloudPayload(word))
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Cloud API ${response.status}: ${detail}`);
  }

  const data = await response.json().catch(() => null);
  return data?.word || null;
}


async function deleteWordFromCloud(word, settings) {
  const baseUrl = String(settings.cloudApiBaseUrl || "").replace(/\/+$/, "");
  const endpoint = word.cloudId ? `${baseUrl}/api/words/${encodeURIComponent(word.cloudId)}` : `${baseUrl}/api/words`;
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "x-api-secret": settings.cloudApiSecret
    },
    body: JSON.stringify({
      original: word.original,
      sourceUrl: word.sourceUrl || ""
    })
  });

  if (!response.ok && response.status !== 404) {
    const detail = await response.text();
    throw new Error(`Cloud API ${response.status}: ${detail}`);
  }
}

async function ensureCloudPermission(baseUrl) {
  const originPattern = toOriginPattern(baseUrl);
  const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });
  if (alreadyGranted) {
    return true;
  }
  return chrome.permissions.request({ origins: [originPattern] });
}

function toCloudPayload(word) {
  return {
    original: word.original,
    translation: word.translation,
    baseForm: word.baseForm,
    partOfSpeech: word.partOfSpeech,
    cefrLevel: word.cefrLevel,
    article: word.article,
    plural: word.plural,
    explanation: word.explanation,
    contextText: word.context,
    contextTranslation: word.contextTranslation,
    sourceTitle: word.sourceTitle,
    sourceUrl: word.sourceUrl
  };
}

function setSyncStatus(message, type) {
  syncStatus.textContent = message;
  syncStatus.className = `sync-status ${type || ""}`.trim();
}

function toOriginPattern(value) {
  const url = new URL(String(value || ""));
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Unsupported cloud API protocol");
  }
  return `${url.origin}/*`;
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
