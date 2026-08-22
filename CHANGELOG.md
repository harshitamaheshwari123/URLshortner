# Changelog

All notable file changes for the LinkSnip build, per project logging
standard: every file created/modified/renamed/moved, timestamped, with
rationale. Times are IST (Asia/Calcutta).

## 22-Aug-2026

- **Created** `supabase/schema.sql` — 15:xx IST. Postgres schema for `links`
  and `clicks` tables, an `updated_at` trigger, and Row Level Security
  policies. Foundation for the whole app; written first since both backend
  and frontend depend on the table shape.
- **Created** `backend/package.json` — dependencies for Express, Supabase
  client, rate limiting, QR code generation, user-agent parsing.
- **Created** `backend/.env.example` — documents required env vars without
  committing real secrets.
- **Created** `backend/src/lib/supabase.js` — server-side Supabase client
  using the `service_role` key (bypasses RLS; routes enforce ownership
  themselves).
- **Created** `backend/src/middleware/auth.js` — verifies Supabase JWTs on
  protected routes (`requireAuth`), plus an `optionalAuth` variant for routes
  that also serve anonymous users (link creation, per PRD user story 1).
- **Created** `backend/src/lib/shortcode.js` — base62 short-code generation
  with collision retry, alias validation, alias-availability check, URL
  validation.
- **Created** `backend/src/lib/safeBrowsing.js` — Google Safe Browsing
  integration (PRD 5.1); no-ops with a warning if no API key is configured,
  documented as a scope item requiring the user's own key.
- **Created** `backend/src/routes/links.js` — link CRUD, bulk archive,
  QR code endpoint.
- **Created** `backend/src/routes/redirect.js` — the redirect service:
  short-code lookup, expired/disabled handling, click logging (device/browser
  parsed from user-agent, IP hashed before storage, geo lookup stubbed — see
  README's deferred-scope list).
- **Created** `backend/src/routes/analytics.js` — per-link analytics
  aggregation (clicks over time, top referrers, device/browser/geo
  breakdown) and CSV export.
- **Created** `backend/src/server.js` — wires up CORS, JSON body parsing,
  rate limiting on `/api/*`, mounts the three route modules.
- **Edited** `backend/src/routes/redirect.js` — removed a redundant
  `res.status(404).render ?` ternary left over from drafting; both branches
  were identical, simplified to a single `res.status(404).send(...)`.
- **Created** `frontend/package.json`, `frontend/vite.config.js`,
  `frontend/index.html`, `frontend/.env.example` — Vite/React project
  scaffold.
- **Created** `frontend/src/lib/supabase.js` — browser-side Supabase client
  (anon key).
- **Created** `frontend/src/lib/api.js` — fetch wrapper for the backend API,
  attaches the Supabase session's bearer token to each request.
- **Created** `frontend/src/lib/AuthContext.jsx` — React context wrapping
  Supabase auth session state.
- **Created** `frontend/src/main.jsx`, `frontend/src/App.jsx` — app entry
  point and route table (login/signup/dashboard/create/link-detail).
- **Created** `frontend/src/pages/Login.jsx`, `Signup.jsx` — auth pages using
  Supabase Auth directly (signup, login, password reset email); email
  verification behavior depends on the Supabase project's Auth settings.
- **Created** `frontend/src/pages/Dashboard.jsx` — link list with
  search/sort, bulk-select and archive, copy-short-URL.
- **Created** `frontend/src/pages/CreateLink.jsx` — link creation form;
  shows alias/tags/expiration fields only when logged in, matching the
  backend's auth requirement for those fields.
- **Created** `frontend/src/pages/LinkDetail.jsx` — per-link view: edit
  destination/expiry, QR code display, CSV export trigger, and three
  Recharts charts (clicks-over-time line chart, referrers and device
  breakdown bar charts).
- **Created** `frontend/src/styles.css` — shared styling for the app shell,
  forms, tables, and charts.
- **Created** `backend/render.yaml` — Render Blueprint for the backend
  service.
- **Created** `frontend/vercel.json` — Vercel build/rewrite config for the
  SPA.
- **Created** `.gitignore` — excludes `node_modules`, build output, and env
  files.
- **Created** `README.md` — setup instructions, project structure, the
  full list of deferred-scope items with reasoning, informal API reference,
  and notes on the short-code and RLS design decisions.
- **Created** `CHANGELOG.md` — this file.
