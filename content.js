const MAX_SELECTION_LENGTH = 300;
const TRANSLATE_DELAY_MS = 150;

let translateTimer;
let requestId = 0;
let panel;

document.addEventListener("mouseup", scheduleTranslation);
document.addEventListener("keyup", (event) => {
  if (event.key.startsWith("Arrow") || event.key === "Shift") {
    scheduleTranslation(event);
  }
});
document.addEventListener("mousedown", (event) => {
  if (panel && !panel.contains(event.target)) {
    removePanel();
  }
});

function scheduleTranslation(event) {
  if (panel?.contains(event.target) || isEditable(event.target)) {
    return;
  }

  clearTimeout(translateTimer);
  const position = { x: event.clientX || 24, y: event.clientY || 24 };
  translateTimer = setTimeout(() => translateCurrentSelection(position), TRANSLATE_DELAY_MS);
}

async function translateCurrentSelection(position) {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  if (!selectedText || selectedText.length > MAX_SELECTION_LENGTH || selection.rangeCount === 0) {
    return;
  }

  const currentRequestId = ++requestId;
  const context = getContextSentence(selection, selectedText);
  const exampleSentence = getExampleSentence(selection, selectedText);
  showLoadingPanel(position, selectedText);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TRANSLATE_SELECTION",
      payload: { selectedText, context, exampleSentence }
    });

    if (currentRequestId !== requestId) {
      return;
    }

    if (!response?.ok) {
      throw new Error(response?.error || "翻译失败，请重试。");
    }

    showTranslationPanel(position, response.translation);
  } catch (error) {
    if (currentRequestId === requestId) {
      showErrorPanel(position, error.message);
    }
  }
}

function getContextSentence(selection, selectedText) {
  const nodeText = selection.anchorNode?.textContent?.replace(/\s+/g, " ").trim() || selectedText;
  const selectedIndex = nodeText.indexOf(selectedText);

  if (selectedIndex === -1) {
    return nodeText.slice(0, 500);
  }

  const start = Math.max(0, selectedIndex - 180);
  const end = Math.min(nodeText.length, selectedIndex + selectedText.length + 180);
  return nodeText.slice(start, end);
}

function getExampleSentence(selection, selectedText) {
  const nodeText = selection.anchorNode?.textContent?.replace(/\s+/g, " ").trim() || selectedText;
  const selectedIndex = nodeText.indexOf(selectedText);

  if (selectedIndex === -1) {
    return selectedText;
  }

  const sentenceStart = findSentenceStart(nodeText, selectedIndex);
  const sentenceEnd = findSentenceEnd(nodeText, selectedIndex + selectedText.length);
  const sentence = nodeText.slice(sentenceStart, sentenceEnd).trim();

  if (sentence && sentence.length <= 300) {
    return sentence;
  }

  const start = Math.max(0, selectedIndex - 80);
  const end = Math.min(nodeText.length, selectedIndex + selectedText.length + 80);
  return nodeText.slice(start, end).trim();
}

function findSentenceStart(text, selectedIndex) {
  const prefix = text.slice(0, selectedIndex);
  const lastBoundary = Math.max(
    prefix.lastIndexOf("."),
    prefix.lastIndexOf("!"),
    prefix.lastIndexOf("?"),
    prefix.lastIndexOf("。"),
    prefix.lastIndexOf("！"),
    prefix.lastIndexOf("？")
  );
  return lastBoundary === -1 ? 0 : lastBoundary + 1;
}

function findSentenceEnd(text, selectedEndIndex) {
  const suffix = text.slice(selectedEndIndex);
  const boundaryOffsets = [".", "!", "?", "。", "！", "？"]
    .map((boundary) => suffix.indexOf(boundary))
    .filter((index) => index !== -1);

  if (boundaryOffsets.length === 0) {
    return text.length;
  }

  return selectedEndIndex + Math.min(...boundaryOffsets) + 1;
}

function showLoadingPanel(position, selectedText) {
  const body = document.createElement("div");
  body.className = "dw-loading";
  body.innerHTML = `<span class="dw-spinner"></span><span>正在翻译“${escapeHtml(selectedText)}”...</span>`;
  renderPanel(position, body);
}

function showErrorPanel(position, message) {
  const body = document.createElement("div");
  body.className = "dw-error";
  body.innerHTML = `
    <strong>暂时无法翻译</strong>
    <span>${escapeHtml(message)}</span>
    <button type="button" data-action="settings">打开设置</button>
  `;
  body.querySelector("[data-action='settings']").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  });
  renderPanel(position, body);
}

function showTranslationPanel(position, translation) {
  const details = [
    translation.article && `冠词：${translation.article}`,
    translation.plural && `复数：${translation.plural}`,
    translation.baseForm && `原形：${translation.baseForm}`,
    translation.partOfSpeech && `词性：${translation.partOfSpeech}`
  ].filter(Boolean);
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="dw-original-row">
      <div class="dw-original">${escapeHtml(translation.original)}</div>
      <button
        type="button"
        class="dw-speak-button"
        data-action="speak"
        title="朗读德语"
        aria-label="朗读德语"
      >🔊</button>
    </div>
    <div class="dw-translation">${escapeHtml(translation.translation)}</div>
    ${details.length ? `<div class="dw-details">${details.map(escapeHtml).join(" · ")}</div>` : ""}
    ${translation.explanation ? `<div class="dw-explanation">${escapeHtml(translation.explanation)}</div>` : ""}
    <div class="dw-actions">
      <span class="dw-status" aria-live="polite"></span>
      <button type="button" data-action="save">保存到单词本</button>
    </div>
  `;

  body.querySelector("[data-action='speak']").addEventListener("click", async () => {
    const spoken = await speakGerman(translation.original);
    if (!spoken) {
      body.querySelector(".dw-status").textContent = "未找到德语语音，请在插件设置中选择。";
    }
  });

  const saveButton = body.querySelector("[data-action='save']");
  saveButton.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const saved = await saveWord(translation);
    button.textContent = saved ? "已保存" : "已保存过";
    body.querySelector(".dw-status").textContent = "";
  });

  renderPanel(position, body);

  isWordSaved(translation).then((alreadySaved) => {
    if (alreadySaved) {
      saveButton.disabled = true;
      saveButton.textContent = "已保存";
    }
  });
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

async function saveWord(translation) {
  const { words = [] } = await chrome.storage.local.get("words");
  if (words.some((word) => isSameWord(word, translation))) {
    return false;
  }

  words.unshift({
    id: crypto.randomUUID(),
    ...translation,
    sourceTitle: document.title,
    sourceUrl: location.href,
    createdAt: new Date().toISOString()
  });
  await chrome.storage.local.set({ words });
  return true;
}

async function isWordSaved(translation) {
  const { words = [] } = await chrome.storage.local.get("words");
  return words.some((word) => isSameWord(word, translation));
}

function isSameWord(word, translation) {
  return normalizeComparisonText(word.original) === normalizeComparisonText(translation.original) &&
    normalizeSourceUrl(word.sourceUrl) === normalizeSourceUrl(location.href);
}

function normalizeComparisonText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function normalizeSourceUrl(value) {
  try {
    const url = new URL(value || location.href);
    url.hash = "";
    return url.href;
  } catch {
    return String(value || "");
  }
}

function renderPanel(position, body) {
  removePanel();
  panel = document.createElement("section");
  panel.id = "dw-translation-panel";
  panel.append(body);
  document.documentElement.append(panel);

  const margin = 12;
  const rect = panel.getBoundingClientRect();
  const left = Math.min(position.x + margin, window.innerWidth - rect.width - margin);
  const top = Math.min(position.y + margin, window.innerHeight - rect.height - margin);
  panel.style.left = `${Math.max(margin, left)}px`;
  panel.style.top = `${Math.max(margin, top)}px`;
}

function removePanel() {
  panel?.remove();
  panel = undefined;
}

function isEditable(element) {
  return element instanceof HTMLElement &&
    (element.isContentEditable || ["INPUT", "TEXTAREA"].includes(element.tagName));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
