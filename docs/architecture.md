# Architecture

## English

German Vocab Extension is a Chrome Manifest V3 extension for learning German while reading online articles.

```text
Web page selection
-> content script
-> background service worker
-> Gemini API
-> translation popup
-> local vocabulary notebook
```

Planned cloud sync path:

```text
local vocabulary notebook
-> server API
-> PostgreSQL
-> daily review scheduler
-> Telegram Bot API
```

### Main components

- `manifest.json`: extension metadata, permissions, content script registration.
- `content.js`: detects selected German text, extracts context and example sentences, renders the translation popup.
- `background.js`: calls the Gemini API, normalizes structured translation results, and caches repeated requests.
- `options.html` / `options.js`: stores API key, model name, and German voice preference in `chrome.storage.local`.
- `words.html` / `words.js`: displays the local vocabulary notebook with search, delete, and pronunciation.
- `server/`: Node.js backend for the future cloud vocabulary notebook, PostgreSQL storage, and Telegram review messages.

### Data storage

The first version stores all vocabulary locally through `chrome.storage.local`. The new backend in `server/` is additive: it prepares cloud sync without breaking the offline local notebook.

## Deutsch

German Vocab Extension ist eine Chrome-Erweiterung auf Basis von Manifest V3. Sie hilft beim Deutschlernen direkt beim Lesen von Webseiten.

```text
Textauswahl auf Webseite
-> Content Script
-> Background Service Worker
-> Gemini API
-> Uebersetzungs-Popup
-> lokales Vokabelheft
```

### Hauptkomponenten

- `manifest.json`: Metadaten, Berechtigungen und Registrierung der Content Scripts.
- `content.js`: erkennt markierten deutschen Text, extrahiert Kontext und Beispielsatz, zeigt das Popup an.
- `background.js`: ruft die Gemini API auf, normalisiert strukturierte Ergebnisse und cached wiederholte Anfragen.
- `options.html` / `options.js`: speichert API-Key, Modellname und deutsche Stimme lokal.
- `words.html` / `words.js`: zeigt das lokale Vokabelheft mit Suche, Loeschen und Aussprache.
