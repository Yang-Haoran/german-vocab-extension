# Cloud Sync Plan

## Goal

Keep the Chrome extension useful offline, while adding a cloud vocabulary notebook that can power daily Telegram reviews.

## Current Phase

The first cloud phase adds a backend server only. The extension can keep using local storage until the sync client is implemented.

```text
Chrome extension
-> Cloud API
-> PostgreSQL
-> Daily scheduler
-> Telegram Bot API
-> Phone
```

## Backend Scope

- `POST /api/words`: save or update one vocabulary item.
- `GET /api/words`: list saved vocabulary items.
- `GET /health`: verify that the service is online.
- PostgreSQL stores vocabulary and review metadata.
- Telegram Bot API sends a daily review message.

## Security Notes

- The browser extension must never contain the Telegram Bot token.
- The backend stores secrets in environment variables.
- The extension should call the backend with an `API_SECRET` header for the first private version.
- A real login system can be added later if more users need access.

## Later Improvements

- Add a sync button in the extension options page.
- Add automatic background sync after saving a word.
- Add spaced repetition fields: difficulty, review count, next review date.
- Add Telegram buttons: know, do not know, review tomorrow.
- Add deployment documentation for the VPS.
