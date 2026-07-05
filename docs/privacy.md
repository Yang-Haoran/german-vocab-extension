# Privacy

## English

- Vocabulary entries are stored locally in the browser using `chrome.storage.local`.
- The Gemini API key is stored locally in the browser and is not committed to this repository.
- Selected text and surrounding context are sent to the configured Gemini model for translation.
- The extension does not currently use a backend server or user account.

If this project is extended with cloud sync, API keys and bot tokens should be stored only on the server, never inside the browser extension.

## Deutsch

- Vokabeln werden lokal im Browser mit `chrome.storage.local` gespeichert.
- Der Gemini API-Key wird lokal im Browser gespeichert und nicht in dieses Repository uebernommen.
- Markierter Text und Kontext werden an das konfigurierte Gemini-Modell zur Uebersetzung gesendet.
- Die Erweiterung nutzt aktuell keinen Backend-Server und kein Benutzerkonto.

Falls spaeter Cloud-Synchronisation ergaenzt wird, duerfen API-Keys und Bot-Tokens nur auf dem Server gespeichert werden, nicht in der Browser-Erweiterung.
