# German Vocab Server

Cloud backend for German Vocab Extension. It stores saved vocabulary in PostgreSQL and can send daily review messages through Telegram Bot API.

## First Run

```bash
cd server
cp .env.example .env
npm install
```

Create the PostgreSQL database, then run the migration:

```bash
psql "$DATABASE_URL" -f migrations/001_create_words.sql
```

Start the server:

```bash
npm run dev
```

## API

All `/api/*` routes require the header:

```text
x-api-secret: your-api-secret
```

### Health Check

```bash
curl http://localhost:3000/health
```

### Save a Word

```bash
curl -X POST http://localhost:3000/api/words   -H "content-type: application/json"   -H "x-api-secret: your-api-secret"   -d '{"original":"treibt","translation":"推动","baseForm":"vorantreiben"}'
```

### List Words

```bash
curl -H "x-api-secret: your-api-secret" http://localhost:3000/api/words
```

## Environment Variables

See `.env.example`.

Never commit `.env`, Telegram tokens, database passwords, or Gemini API keys.

## Telegram Review Buttons

Daily review messages use Telegram URL buttons instead of bot polling. This avoids conflicts when the same Telegram bot is already used by another service. Button links are signed with `REVIEW_ACTION_SECRET` or `API_SECRET` and call `/api/reviews/:wordId/:result`.

Supported results:

- `show`: show the answer page.
- `know`: mark as known and schedule later review.
- `unsure`: mark as unclear and review soon.
- `forgot`: mark as forgotten and review tomorrow.

## Dedicated Telegram Review Bot

For a smoother review flow, the server can use a dedicated Telegram bot via `REVIEW_TELEGRAM_BOT_TOKEN` and `REVIEW_TELEGRAM_CHAT_ID`. This bot supports native Telegram interactions:

- `/start`: show the welcome message.
- `/review`: start an immediate review session.
- `/stats`: show vocabulary and review stats.
- `显示答案`: reveal the answer by editing the Telegram message.
- `认识 / 模糊 / 忘了`: save the review result and send the next due word.

Daily reviews still run with `DAILY_REVIEW_CRON` and `DAILY_REVIEW_TIMEZONE`; the default is 09:00 Europe/Berlin.
