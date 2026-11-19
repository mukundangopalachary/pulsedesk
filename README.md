# PulseDesk

Customer feedback inbox: a public feedback form and roadmap per workspace, plus a team inbox with AI triage, comments, Slack alerts and team invites. React + Vite + Tailwind on Supabase (Postgres, Auth, Storage, Edge Functions).

## Setup

```bash
npm ci
# create .env with the two values below
npm run dev
```

Frontend `.env` (public values, shipped to the browser):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_TURNSTILE_SITE_KEY=   # optional: Cloudflare Turnstile site key (public)
VITE_SENTRY_DSN=           # optional: enables Sentry error tracking
```

Never put secrets in a `VITE_` variable.

## Database

Apply the SQL in `supabase/migrations/` in order (`supabase db push`). Every table has Row Level Security; public access goes through narrow policies and `SECURITY DEFINER` functions.

## Edge functions

Deploy with `supabase functions deploy ai notify-slack send-invite public-actions`. Set secrets in the dashboard (Edge Functions → Secrets) or `supabase secrets set`:

| Secret | Used by | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `ai` | Gemini classification, summaries, reply drafts |
| `RESEND_API_KEY` | `send-invite` | Invite emails (optional; the link is still returned) |
| `APP_URL` | `send-invite` | Base URL for invite links, e.g. `https://app.example.com` |
| `TURNSTILE_SECRET_KEY` | `public-actions` | Enforces the Turnstile captcha on public submit and vote. Unset = no captcha |
| `ALLOWED_ORIGINS` | all | Comma-separated CORS allow-list. Unset means `*`, so set it in production |

`public-actions`: all anonymous writes (feedback submit, screenshot upload URL, roadmap vote) go through this function. Direct anonymous inserts and uploads are disabled in the database. It applies a database-backed rate limit per IP and optional Turnstile verification.

`ai`: `classify` is public (used by the feedback form) and rate limited per IP; `summarize` and `draft_reply` require a signed-in user. Limits use the `check_rate_limit` database function. Extra DB-side limits: `throttle_public_feedback` trigger and `toggle_upvote`.

`notify-slack` has to stay callable without a user session (the public form triggers it). It only acts on feedback created in the last 10 minutes, once per item.

## Quality checks

```bash
npm run lint && npm run typecheck && npm run build
```

CI (`.github/workflows/ci.yml`) runs these plus `npm audit --omit=dev --audit-level=high` on every PR.

## Production checklist

- [ ] `ALLOWED_ORIGINS`, `APP_URL`, `GEMINI_API_KEY` set
- [ ] Turnstile keys set (`TURNSTILE_SECRET_KEY` + `VITE_TURNSTILE_SITE_KEY`)
- [ ] `VITE_SENTRY_DSN` set at build time
- [ ] Supabase backups / point-in-time recovery enabled
- [ ] Custom domain with HTTPS
- [ ] Uptime monitor on the public feedback page
