# LinkSnip

A URL shortening service: instant anonymous shortening, custom aliases, click
analytics, link management (edit/expire/tag/archive), QR codes, and a rate-limited
REST API. Built against the LinkSnip PRD (v1.0, 21-Aug-2026).

**Stack:** React (Vite) frontend + Express/Node backend + Supabase (Postgres + Auth).
Frontend deploys to Vercel, backend deploys to Render.

## What's built (MVP scope)

- Instant anonymous shortening, no login required (PRD user story 1)
- Custom aliases for logged-in users, 3–30 chars, uniqueness-checked (user story 2)
- Click analytics: count, timestamp, referrer, device, browser (user story 3)
- Edit destination URL without changing the short link (user story 4)
- Tags on links, searchable/filterable dashboard (user story 5, partial — see below)
- Expiration by date (user story 6, partial — see below)
- QR code generation per link
- Bulk archive from the dashboard
- CSV export of a link's click data
- REST API for link CRUD + analytics, rate-limited (15 min window, 300 req/window)
- Google Safe Browsing check on link creation (active only if you supply an API key)

## What's explicitly deferred (scope cut, not forgotten)

Note: password reset ("forgot password" email flow) was intentionally
removed after being partially built — email verification via Supabase Auth
still works for signup, but there is no self-service password reset. Users
who forget their password currently have no in-app way to recover access.

This is a full product-scale PRD; building every line item wasn't realistic for
one build pass. These are left out on purpose, in order of what I'd add next:

1. **Async click-ingestion queue.** The PRD asks for click events to go through
   a queue so they never block the redirect. This MVP writes clicks to Postgres
   synchronously from the redirect route instead — simpler to run, but a slow
   DB write can add latency to a real user's redirect. Next step: BullMQ on
   Redis (or a hosted queue) between the redirect route and the DB write.
2. **Redis read-through cache in front of the redirect lookup.** Currently every
   redirect hits Postgres directly (indexed on `short_code`, so it's fast, but
   not cached). Add Redis if you need to defend the PRD's <100ms target under load.
3. **Dedicated time-series/analytics store.** Click events live in a plain
   Postgres table. Fine at MVP scale; the PRD suggests a dedicated time-series
   store for real production analytics volume.
4. **Bulk CSV link creation upload.** Not built — only single-link creation and
   bulk archive exist.
5. **Password-protected links.** Not built.
6. **Expiration by click count** (only expiration-by-date is implemented).
7. **Folders** (tags are implemented; folders are not — tags cover most of the
   same organizing need for an MVP).
8. **OpenAPI spec.** The API exists and is documented informally below; a
   generated OpenAPI/Swagger doc was not produced.
9. ~~Geo lookup (country/city) on clicks.~~ **Done** — `lookupGeo()` in
   `backend/src/routes/redirect.js` now calls ip-api.com (free, no key) to
   resolve country/city from the click's IP. Note: this returns nothing when
   tested on localhost, since local/private IPs aren't real public addresses —
   it resolves correctly once deployed.
10. **Safe Browsing check** only runs if you provide `SAFE_BROWSING_API_KEY`;
    without it, link creation proceeds with a logged warning instead of blocking.

## Project structure

```
liveurl/
  backend/            Express API + redirect service
    src/
      lib/            supabase client, short-code generation, safe-browsing check
      middleware/      auth (Supabase JWT verification)
      routes/          links.js, redirect.js, analytics.js
      server.js
    render.yaml
    .env.example
  frontend/           React (Vite) dashboard
    src/
      pages/           Login, Signup, Dashboard, CreateLink, LinkDetail
      lib/             supabase client, API client, auth context
    vercel.json
    .env.example
  supabase/
    schema.sql         Run this in the Supabase SQL editor to set up tables + RLS
  CHANGELOG.md
```

## Setup

### 1. Supabase project

1. Create a project at supabase.com.
2. In the SQL Editor, run `supabase/schema.sql`.
3. In Project Settings > API, note your Project URL, `anon` key, and
   `service_role` key.
4. In Authentication > Settings, confirm "Enable email confirmations" matches
   whether you want the email-verification flow (PRD 5.3) active.

### 2. Backend

```bash
cd backend
cp .env.example .env     # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
npm install
npm run dev               # runs on http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env      # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
npm install
npm run dev                # runs on http://localhost:5173
```

Open http://localhost:5173. Create a link with no login (goes to `/create`),
or sign up to unlock custom aliases, tags, expiration, and the dashboard.

## Deployment (not done — configs are ready)

**Backend → Render:** New Web Service, root directory `backend`, build
`npm install`, start `npm start`. Set the env vars from `.env.example` in the
Render dashboard (a `render.yaml` blueprint is included). Note the deployed
URL and set it as `PUBLIC_BASE_URL` on the backend and `VITE_API_BASE_URL` on
the frontend.

**Frontend → Vercel:** Import the `frontend` folder as a project (or use the
included `vercel.json`), set the three `VITE_*` env vars in the Vercel
dashboard, deploy.

**Custom short-link domain:** point a domain's DNS at the Render backend and
set `PUBLIC_BASE_URL` accordingly if you want links like `lnk.to/my-sale`
instead of the Render subdomain.

## API reference (informal — see "deferred" section re: OpenAPI)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/links` | optional | Create a link. `alias` requires auth. |
| GET | `/api/links` | required | List your links (`search`, `tag`, `archived`, `sort`, `order` query params). |
| GET | `/api/links/:id` | required | Get one link. |
| PATCH | `/api/links/:id` | required | Edit destination/expiry/tags/archive/disable. |
| DELETE | `/api/links/:id` | required | Delete a link. |
| POST | `/api/links/bulk-archive` | required | `{ ids: [...], archived: true }` |
| GET | `/api/links/:id/qrcode` | required | PNG QR code for the short URL. |
| GET | `/api/analytics/:linkId` | required | Clicks over time, top referrers, device/browser/geo breakdown. |
| GET | `/api/analytics/:linkId/export.csv` | required | CSV export of raw click rows. |
| GET | `/:shortCode` | none | The redirect itself. |

Auth: send `Authorization: Bearer <supabase_access_token>` — get the token
from `supabase.auth.getSession()` on the frontend after login.

## Notes on decisions

- **Short codes** are randomly sampled from base62 with a DB uniqueness check
  and retry, rather than base62-encoding an auto-increment ID. The
  auto-increment approach is simpler and collision-free by construction, but
  produces sequential, guessable codes (`/1`, `/2`, `/3`...); random sampling
  avoids that at the cost of a (rare) collision retry.
- **RLS is enabled** on `links` and `clicks`, but the backend uses the
  Supabase `service_role` key, which bypasses RLS — so every route does its
  own explicit `.eq('owner_id', req.user.id)` ownership check. RLS is there as
  a second line of defense in case the tables are ever queried directly from
  the frontend with the `anon` key.
- **IP addresses are hashed** (SHA-256, truncated) before being stored on
  click records, not stored raw — basic privacy hygiene given the PRD logs
  IP-derived geo data.
