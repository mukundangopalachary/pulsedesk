# Project memory

## Product intent & audience

- PulseDesk: customer feedback collection and team inbox app.
- Two user types: anonymous visitors (submit feedback via public form) and team members (manage feedback in signed-in inbox).
- Core flow: team signs up → creates workspace → shares public feedback link → visitors rate & leave feedback → team triages in inbox.
- AI features: auto-classify feedback on submit, weekly summary, and draft reply generation — all powered by Google Gemini.

## Brand personality & voice

- Product name: PulseDesk.
- Tone implied: professional, trustworthy, clean SaaS tooling.

## Visual design & UX direction

- Light/dark mode support throughout.
- Public feedback form route: `/f/:workspace` — loads workspace name and link without auth.
- Signed-in inbox: workspace-scoped feedback management UI.
- AI UI patterns: "Summarise this week" button (sparkles icon) in inbox header → dismissible card; "Draft reply" button in feedback detail → generated text with Copy button; sentiment/category badges auto-applied to inbox items.
- Graceful AI fallback: when key not configured, AI buttons show "key not configured" state; feedback still submits uncategorized.
- Icons via lucide-react; styling via Tailwind CSS; path alias `@/` → `src/`.
- Aesthetic goal: production-grade, non-cookie-cutter (per global prompt).

## Decisions, constraints & rationale

- Stack: Vite + React (JSX), Tailwind CSS, lucide-react, React hooks. No extra UI/icon packages.
- Backend: database with row-level access rules (likely Supabase) — public can only submit; signed-in users manage own workspace data only.
- DB security design: public feedback form intentionally exposes workspace name/link without auth; all other access is auth-scoped. Four lint "notes" are expected/acceptable.
- Inbox features: filter by status, assign to teammates, add tags, internal comments, delete entries.
- AI implementation: Gemini API called via edge function (server-side) to keep API key secure; frontend AI helper module calls the edge function.
- AI classification taxonomy: categories = bug / feature request / pricing / support / other; sentiment = positive / neutral / negative.
- AI features degrade gracefully when key absent — feedback flow never blocked by AI unavailability.
- Build verified passing after AI additions.

## Open questions & assumptions

- `GEMINI_API_KEY` project secret not yet configured — AI features non-functional until added (Google AI Studio key).
- No explicit routing library confirmed; assumption is react-router or similar given `/f/:workspace` routes.
- Database provider not explicitly stated; inferred Supabase from security-check behavior and edge function usage.
- Auth provider/mechanism not detailed; assumption is built-in or Supabase Auth.
- Deployment target and environment variables not yet discussed.
- Edge function deployment target (Supabase) inferred but not explicitly confirmed.