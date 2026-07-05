const form = document.querySelector("#settingsForm");
const apiKeyInput = document.querySelector("#apiKey");
const modelInput = document.querySelector("#model");
const voiceSelect = document.querySelector("#voice");
const cloudSyncEnabledInput = document.querySelector("#cloudSyncEnabled");
const cloudApiBaseUrlInput = document.querySelector("#cloudApiBaseUrl");
const cloudApiSecretInput = document.querySelector("#cloudApiSecret");
const status = document.querySelector("#status");

chrome.storage.local.get([
  "geminiApiKey",
  "geminiModel",
  "germanVoiceURI",
  "cloudSyncEnabled",
  "cloudApiBaseUrl",
  "cloudApiSecret"
]).then(async (settings) => {
  apiKeyInput.value = settings.geminiApiKey || "";
  modelInput.value = settings.geminiModel || "gemini-3.1-flash-lite";
  cloudSyncEnabledInput.checked = Boolean(settings.cloudSyncEnabled);
  cloudApiBaseUrlInput.value = settings.cloudApiBaseUrl || "https://sea1.ktno.cc/vocab";
  cloudApiSecretInput.value = settings.cloudApiSecret || "";
  await populateGermanVoices(settings.germanVoiceURI);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await chrome.storage.local.set({
    geminiApiKey: apiKeyInput.value.trim(),
    geminiModel: modelInput.value.trim(),
    germanVoiceURI: voiceSelect.value,
    cloudSyncEnabled: cloudSyncEnabledInput.checked,
    cloudApiBaseUrl: normalizeBaseUrl(cloudApiBaseUrlInput.value),
    cloudApiSecret: cloudApiSecretInput.value.trim()
  });
  status.textContent = "设置已保存。现在可以到网页中选词测试。";
  status.className = "status success";
});

document.querySelector("#openWords").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("words.html") });
});

document.querySelector("#previewVoice").addEventListener("click", () => {
  const voice = speechSynthesis.getVoices().find((item) => item.voiceURI === voiceSelect.value);
  if (!voice) {
    status.textContent = "当前系统没有可用的德语声音。";
    status.className = "status";
    return;
  }

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance("Guten Tag! Ich lerne Deutsch.");
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.85;
  speechSynthesis.speak(utterance);
});

async function populateGermanVoices(selectedVoiceURI) {
  const voices = await loadVoices();
  const germanVoices = voices.filter((voice) =>
    voice.lang.toLocaleLowerCase().startsWith("de")
  );

  voiceSelect.innerHTML = "";

  if (germanVoices.length === 0) {
    const option = document.createElement("option");
    option.textContent = "未找到德语声音";
    option.value = "";
    voiceSelect.append(option);
    return;
  }

  germanVoices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})${voice.localService ? " - 本地" : ""}`;
    option.selected = voice.voiceURI === selectedVoiceURI;
    voiceSelect.append(option);
  });
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


function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}
