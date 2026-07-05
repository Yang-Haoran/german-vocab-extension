document.querySelector("#openWords").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("words.html") });
});

document.querySelector("#openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.local.get("words").then(({ words = [] }) => {
  document.querySelector("#summary").textContent =
    `当前已收藏 ${words.length} 个词条。在网页中选中德语文本，即可自动翻译。`;
});
