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
```

Never put secrets in a `VITE_` variable.

## Database

Apply the SQL in `supabase/migrations/` in order (`supabase db push`). Every table has Row Level Security; public access goes through narrow policies and `SECURITY DEFINER` functions.

## Edge functions

Deploy with `supabase functions deploy ai notify-slack send-invite`. Set secrets in the dashboard (Edge Functions → Secrets) or `supabase secrets set`:

| Secret | Used by | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `ai` | Gemini classification, summaries, reply drafts |
| `RESEND_API_KEY` | `send-invite` | Invite emails (optional; the link is still returned) |
| `APP_URL` | `send-invite` | Base URL for invite links, e.g. `https://app.example.com` |
| `ALLOWED_ORIGINS` | all | Comma-separated CORS allow-list. Unset means `*`, so set it in production |

`ai`: `classify` is public (used by the feedback form) and rate limited per IP; `summarize` and `draft_reply` require a signed-in user. The in-function rate limiter is per instance and best effort. The hard limits are in the database (`throttle_public_feedback` trigger, `toggle_upvote`).

## Quality checks

```bash
npm run lint && npm run typecheck && npm run build
```

CI (`.github/workflows/ci.yml`) runs these plus `npm audit --omit=dev --audit-level=high` on every PR.

## Production checklist

- [ ] `ALLOWED_ORIGINS`, `APP_URL`, `GEMINI_API_KEY` set
- [ ] Supabase backups / point-in-time recovery enabled
- [ ] Custom domain with HTTPS
- [ ] Error tracking (Sentry) wired into `src/components/ErrorBoundary.tsx`
- [ ] Uptime monitor on the public feedback page
