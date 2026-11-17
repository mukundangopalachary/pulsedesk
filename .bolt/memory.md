# Project memory

## Product intent & audience

- PulseDesk: customer feedback collection and team inbox app.
- Two user types: anonymous visitors (submit feedback via public form) and team members (manage feedback in signed-in inbox).
- Core flow: team signs up → creates workspace → shares public feedback link → visitors rate & leave feedback → team triages in inbox.

## Brand personality & voice

- Product name: PulseDesk.
- Tone implied: professional, trustworthy, clean SaaS tooling.

## Visual design & UX direction

- Light/dark mode support throughout.
- Public feedback form route: `/f/:workspace` — loads workspace name and link without auth.
- Signed-in inbox: workspace-scoped feedback management UI.
- Icons via lucide-react; styling via Tailwind CSS; path alias `@/` → `src/`.
- Aesthetic goal: production-grade, non-cookie-cutter (per global prompt).

## Decisions, constraints & rationale

- Stack: Vite + React (JSX), Tailwind CSS, lucide-react, React hooks. No extra UI/icon packages.
- Backend: database with row-level access rules (likely Supabase) — public can only submit; signed-in users manage own workspace data only.
- DB security design: public feedback form intentionally exposes workspace name/link without auth; all other access is auth-scoped. Four lint "notes" are expected/acceptable.
- Inbox features: filter by status, assign to teammates, add tags, internal comments, delete entries.
- Build verified passing.

## Open questions & assumptions

- No explicit routing library confirmed; assumption is react-router or similar given `/f/:workspace` routes.
- Database provider not explicitly stated; inferred Supabase from security-check behavior.
- Auth provider/mechanism not detailed; assumption is built-in or Supabase Auth.
- Deployment target and environment variables not yet discussed.