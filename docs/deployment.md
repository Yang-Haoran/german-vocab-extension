# Deployment Notes

This project uses a simple private VPS deployment. The VPS should run the backend, database, HTTPS reverse proxy, and Telegram review process. Code changes should be made locally and pushed to GitHub; the VPS should pull code from GitHub instead of being edited manually.

## Deployment Model

```text
Local machine
-> edit code
-> commit and push to GitHub
-> VPS pulls from GitHub
-> server runs with PM2
```

## VPS Components

- Node.js server in `/srv/german-vocab-extension/server` (example path).
- PostgreSQL running in Docker.
- Caddy running in Docker for HTTPS and reverse proxy.
- PM2 running under a dedicated service user to keep the Node.js server online.
- `netfilter-persistent` to keep firewall rules after reboot.

## Public Endpoint

Configure your own HTTPS endpoint, for example:

```text
https://your-domain.example/vocab
```

The extension sends API requests to:

```text
https://your-domain.example/vocab/api/words
```

Caddy forwards this to:

```text
http://127.0.0.1:3000/api/words
```

## Environment Variables

The server requires a `.env` file in `server/`. This file is intentionally not committed.

Example:

```env
PORT=3000
DATABASE_URL=postgresql://german_vocab:change-me@127.0.0.1:5432/german_vocab
API_SECRET=change-me
TELEGRAM_BOT_TOKEN=replace-with-token
TELEGRAM_CHAT_ID=replace-with-chat-id
DAILY_REVIEW_CRON=0 9 * * *
```

Never commit real values for:

- `DATABASE_URL`
- `API_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- Gemini API keys

## Useful VPS Commands

Check backend status:

```bash
pm2 status
```

Show backend logs:

```bash
pm2 logs german-vocab-server
```

Restart backend after pulling new code:

```bash
cd /srv/german-vocab-extension/server
pm2 restart german-vocab-server --update-env
```

Check HTTPS health endpoint:

```bash
curl https://your-domain.example/vocab/health
```

Check Caddy container:

```bash
sudo docker ps | grep german-vocab-caddy
```

Check PostgreSQL container:

```bash
sudo docker ps | grep german-vocab-postgres
```

## Reboot Behavior

The backend process list is saved with PM2. A user-level crontab can run PM2 resurrect after reboot:

```text
@reboot /usr/bin/env pm2 resurrect
```

Docker containers use restart policies, so PostgreSQL and Caddy can restart automatically after a VPS reboot.
