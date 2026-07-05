const form = document.querySelector("#settingsForm");
const apiKeyInput = document.querySelector("#apiKey");
const modelInput = document.querySelector("#model");
const modelPreset = document.querySelector("#modelPreset");
const voiceSelect = document.querySelector("#voice");
const status = document.querySelector("#status");
const testModelsInput = document.querySelector("#testModels");
const testTextInput = document.querySelector("#testText");
const testContextInput = document.querySelector("#testContext");
const testExampleInput = document.querySelector("#testExample");
const benchmarkResults = document.querySelector("#benchmarkResults");

const MODEL_PRESETS = [
  { label: "Gemini 3.1 Flash-Lite", value: "gemini-3.1-flash-lite" },
  { label: "Gemma 4 26B", value: "Gemma 4 26B" },
  { label: "Gemma 4 31B", value: "Gemma 4 31B" },
  { label: "自定义", value: "" }
];

chrome.storage.local.get(["geminiApiKey", "geminiModel", "germanVoiceURI"]).then(async (settings) => {
  const savedModel = settings.geminiModel || "gemini-3.1-flash-lite";
  populateModelPresets(savedModel);
  apiKeyInput.value = settings.geminiApiKey || "";
  modelInput.value = savedModel;
  testModelsInput.value = MODEL_PRESETS
    .filter((model) => model.value)
    .map((model) => model.value)
    .join("\n");
  await populateGermanVoices(settings.germanVoiceURI);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await chrome.storage.local.set({
    geminiApiKey: apiKeyInput.value.trim(),
    geminiModel: modelInput.value.trim(),
    germanVoiceURI: voiceSelect.value
  });
  status.textContent = "设置已保存。现在可以到网页中选词测试。";
  status.className = "status success";
});

document.querySelector("#openWords").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("words.html") });
});

modelPreset.addEventListener("change", () => {
  if (modelPreset.value) {
    modelInput.value = modelPreset.value;
  }
});

modelInput.addEventListener("input", () => {
  const matchedPreset = MODEL_PRESETS.find((model) => model.value === modelInput.value.trim());
  modelPreset.value = matchedPreset?.value || "";
});

document.querySelector("#runSelectedModelTest").addEventListener("click", async () => {
  await runModelTests([modelInput.value.trim()].filter(Boolean));
});

document.querySelector("#runAllModelTests").addEventListener("click", async () => {
  const models = testModelsInput.value
    .split("\n")
    .map((model) => model.trim())
    .filter(Boolean);
  await runModelTests(models);
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

function populateModelPresets(selectedModel) {
  modelPreset.innerHTML = "";

  MODEL_PRESETS.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.value;
    option.textContent = model.label;
    option.selected = model.value === selectedModel;
    modelPreset.append(option);
  });

  if (!MODEL_PRESETS.some((model) => model.value === selectedModel)) {
    modelPreset.value = "";
  }
}

async function runModelTests(models) {
  if (!apiKeyInput.value.trim()) {
    benchmarkResults.innerHTML = `<div class="empty compact">请先填写并保存 Gemini API Key。</div>`;
    return;
  }

  if (models.length === 0) {
    benchmarkResults.innerHTML = `<div class="empty compact">请至少填写一个模型名称。</div>`;
    return;
  }

  benchmarkResults.innerHTML = "";

  for (const model of models) {
    const row = createBenchmarkRow(model);
    benchmarkResults.append(row);

    const resultBody = row.querySelector("[data-result]");
    const actionArea = row.querySelector("[data-actions]");

    try {
      const response = await chrome.runtime.sendMessage({
        type: "TEST_MODEL",
        payload: {
          model,
          selectedText: testTextInput.value,
          context: testContextInput.value,
          exampleSentence: testExampleInput.value
        }
      });

      if (!response?.ok) {
        throw new Error(response?.error || "测试失败。");
      }

      renderBenchmarkSuccess(resultBody, response.result);
      actionArea.append(createUseModelButton(model));
    } catch (error) {
      renderBenchmarkError(resultBody, error.message);
    }
  }
}

function createBenchmarkRow(model) {
  const row = document.createElement("article");
  row.className = "benchmark-row";
  row.innerHTML = `
    <header>
      <strong>${escapeHtml(model)}</strong>
      <span data-actions></span>
    </header>
    <div data-result class="hint">测试中...</div>
  `;
  return row;
}

function renderBenchmarkSuccess(container, result) {
  const translation = result.translation || {};
  container.className = "benchmark-result success";
  container.innerHTML = `
    <div><strong>成功</strong> · ${(result.durationMs / 1000).toFixed(2)}s</div>
    <div>翻译：${escapeHtml(translation.translation || "无")}</div>
    <div>原形：${escapeHtml(translation.baseForm || "-")} · 词性：${escapeHtml(translation.partOfSpeech || "-")}</div>
    <div>解释：${escapeHtml(translation.explanation || "-")}</div>
  `;
}

function renderBenchmarkError(container, message) {
  container.className = "benchmark-result error";
  container.innerHTML = `<strong>失败</strong> · ${escapeHtml(message)}`;
}

function createUseModelButton(model) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary small-button";
  button.textContent = "设为默认";
  button.addEventListener("click", async () => {
    modelInput.value = model;
    const matchedPreset = MODEL_PRESETS.find((preset) => preset.value === model);
    modelPreset.value = matchedPreset?.value || "";
    await chrome.storage.local.set({ geminiModel: model });
    status.textContent = `已将默认模型设置为 ${model}。`;
    status.className = "status success";
  });
  return button;
}

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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
