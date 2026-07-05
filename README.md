# German Vocab Extension

**English:** A Chrome extension for learning German while reading online articles. Select a German word or phrase, get a context-aware Chinese explanation, listen to pronunciation, and save it to a local vocabulary notebook.

**Deutsch:** Eine Chrome-Erweiterung zum Deutschlernen beim Lesen von Webseiten. Man markiert ein deutsches Wort oder eine Phrase, bekommt eine kontextbezogene chinesische Erklaerung, kann die Aussprache hoeren und den Eintrag lokal speichern.

## Features

- Automatic translation after selecting German text on a webpage.
- Context-aware explanations powered by the Gemini API.
- German pronunciation through the browser's speech synthesis API.
- Local vocabulary notebook with search and delete.
- Saves source title, source URL, example sentence, and Chinese explanation.
- Duplicate protection for already saved words from the same page.
- Local caching to reduce repeated API calls.
- Chinese user interface for the first version.

## Funktionen

- Automatische Uebersetzung nach dem Markieren von deutschem Text.
- Kontextbezogene Erklaerungen mit der Gemini API.
- Deutsche Aussprache ueber die Speech-Synthesis-API des Browsers.
- Lokales Vokabelheft mit Suche und Loeschfunktion.
- Speicherung von Titel, URL, Beispielsatz und chinesischer Erklaerung.
- Schutz vor doppelten Eintraegen auf derselben Webseite.
- Lokaler Cache zur Reduzierung wiederholter API-Anfragen.
- Chinesische Benutzeroberflaeche in der ersten Version.

## Tech Stack

- Chrome Extension Manifest V3
- JavaScript
- HTML
- CSS
- Gemini API
- `chrome.storage.local`
- Web Speech API

## Installation

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this project folder.
5. Open the extension options page.
6. Add your Gemini API key and model name.
7. Refresh a German article page and select a word.

## Privacy

The extension stores vocabulary and settings locally in the browser. The Gemini API key is not stored in the repository. Selected text and context are sent to the configured Gemini model for translation.

More details: [docs/privacy.md](docs/privacy.md)

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Roadmap

See [docs/roadmap.md](docs/roadmap.md).

## Why I Built This

**English:** I built this project while preparing for an IT Ausbildung in Germany. It solves a real learning problem: saving useful German vocabulary directly from articles without interrupting the reading flow.

**Deutsch:** Ich habe dieses Projekt waehrend meiner Vorbereitung auf eine IT-Ausbildung in Deutschland gebaut. Es loest ein echtes Lernproblem: nuetzliche deutsche Vokabeln direkt aus Artikeln speichern, ohne den Lesefluss zu unterbrechen.

## License

MIT
