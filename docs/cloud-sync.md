# Cloud Sync

## Goal

Keep the Chrome extension useful offline, while adding a private cloud vocabulary notebook that can power daily Telegram reviews.

## Current Phase

The current version supports manual cloud sync from the local vocabulary notebook.

```text
Chrome extension
-> local vocabulary notebook
-> manual sync button
-> HTTPS Cloud API
-> PostgreSQL
-> Telegram Bot API
-> phone review message
```

## Backend Scope

- `POST /api/words`: save or update one vocabulary item.
- `GET /api/words`: list saved vocabulary items.
- `GET /health`: verify that the service is online.
- PostgreSQL stores vocabulary and review metadata.
- Telegram Bot API sends review messages.

## Sync Strategy

The extension keeps local storage as the source of truth for daily reading. Cloud sync is additive:

1. The user saves a word locally.
2. The local word remains available even if the backend is offline.
3. The user opens the local notebook and clicks "sync to cloud".
4. Unsynced words are uploaded to the backend.
5. Successfully uploaded words receive a local `cloudSyncedAt` timestamp.

This avoids blocking the reading flow and makes the first version robust enough for personal use.

## Security Notes

- The browser extension must never contain the Telegram Bot token.
- The backend stores secrets in environment variables.
- The extension calls the backend with an `API_SECRET` header for the first private version.
- Real login and multi-user accounts can be added later if the project expands beyond private use.

## Later Improvements

- Add automatic background sync after saving a word.
- Add spaced repetition fields: difficulty, review count, next review date.
- Add Telegram buttons: know, unclear, do not know.
- Add a small web dashboard for cloud vocabulary review.
- Add export to CSV or Anki.
