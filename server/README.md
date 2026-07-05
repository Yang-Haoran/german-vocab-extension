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
