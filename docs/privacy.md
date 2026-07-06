# Privacy

## English

- Vocabulary entries are stored locally in the browser using `chrome.storage.local`.
- The Gemini API key is stored locally in the browser and is not committed to this repository.
- Selected text and surrounding context are sent to the configured Gemini model for translation.
- Cloud sync is manual. Only words saved by the user are uploaded to the private backend.
- The backend stores synced vocabulary entries in PostgreSQL.
- Telegram Bot tokens, database passwords, API secrets, and `.env` files must stay on the server and must never be committed.

## Deutsch

- Vokabeln werden lokal im Browser mit `chrome.storage.local` gespeichert.
- Der Gemini API-Key wird lokal im Browser gespeichert und nicht in dieses Repository uebernommen.
- Markierter Text und Kontext werden an das konfigurierte Gemini-Modell zur Uebersetzung gesendet.
- Die Cloud-Synchronisation erfolgt manuell. Nur vom Benutzer gespeicherte Vokabeln werden an das private Backend uebertragen.
- Das Backend speichert synchronisierte Vokabeln in PostgreSQL.
- Telegram-Bot-Tokens, Datenbankpasswoerter, API-Secrets und `.env`-Dateien duerfen nur auf dem Server liegen und niemals committed werden.
