# NoteLatte — Progress Report

| Field | Value |
| --- | --- |
| Project | NoteLatte — minimalist Notion-style notes app |
| Repository | `github.com/LoZHong/NoteLatte` (branch `main`) |
| Report date | 2026-10-20 18:45 (UTC+8) |
| Current status | Feature-complete MVP plus card interaction pass. Build, lint and type checks green. Verified against the production Neon database. Ready for Vercel deployment. |
| Latest commit | `19fb950` — Add card interactions: click-to-edit, status cycling, pinning, drag reorder |
| Working tree | Clean |

---

## 1. Executive Summary

NoteLatte has moved from a client-only UI prototype to a **full-stack Next.js App Router
application** with a real relational database and real session authentication.

- **Frontend:** Next.js 13.5.1 (App Router), React 18.2, Tailwind CSS 3 + shadcn/ui (Radix).
  The visual design, component library and Tailwind classes are unchanged from the approved
  prototype.
- **Backend:** Route Handlers under `app/api/**` running on the Node runtime.
- **ORM / database:** Prisma 6.19.3 against **Neon PostgreSQL**, schema pushed and client generated.
- **Auth:** Email + password (bcrypt, cost 10) issuing a 30-day HS256 JWT stored in an
  `HttpOnly` cookie (`jose`). All data access is scoped to the authenticated `userId`.
- **Data isolation:** Verified — a second account receives `404` for another account's note id
  (no IDOR, no existence leak).
- **Interactions:** Click any card to edit it in place; click a status badge to cycle
  `Todo → In-Progress → On-Hold → Done`; pin a card to float it above the rest; drag cards to
  reorder them. All four mutations persist to Postgres immediately.

No mock state, no `localStorage` session, and no hardcoded seed array remains in the application
code. The prototype's 8 demo notes were retired; new accounts start on the existing empty state.

---

## 2. Timespan / Milestones

All timestamps UTC+8. Elapsed wall-clock from first commit to this report: **~24 hours**; active
implementation on day one: **94 minutes** between the UI prototype commit and the backend commit.

| # | Date / time | Milestone | Commit | Outcome |
| --- | --- | --- | --- | --- |
| 1 | 2026-10-19 18:12 | **Scaffold** — Bolt `nextjs-shadcn` template imported | `fb60f21`, `f248729` | Next 13.5.1 + TypeScript 5.2 + Tailwind + 47 shadcn primitives; three client pages; `AuthProvider` with `localStorage["notelatte:user"]`; 8 notes seeded in `useState`. |
| 2 | 2026-10-19 18:17 | **UI prototype complete** — landing, auth, dashboard | `93f33e8` | Landing marketing page, sign in / sign up form, dashboard with filter chips, title search, status counts, create/edit dialog. Styling approved as-is. |
| 3 | 2026-10-19 18:17–19:45 | **Architecture review** (read-only) | — | Confirmed the coupling surface: mock user in context + `localStorage`, notes in a module-level seed array, no API layer, no schema. Identified a latent `useSearchParams` prerender hazard on `/auth`. |
| 4 | 2026-10-19 19:51 | **Neon DB, Prisma migration, API handlers, auth wiring, build verification** | `2a86730` | Schema pushed via `prisma db push`; 6 route handlers; client swapped to the API; 22-assertion API matrix and a browser walkthrough passed; cold production build green; committed (19 files). |
| 5 | 2026-10-19 20:07 | **First real usage** (post-handover) | — | Two real accounts created and 6 notes written through the UI, confirming end-to-end persistence outside the test harness. Data preserved. |
| 6 | 2026-10-20 18:17 | **Re-verification** | — | Cold rebuild, lint, typecheck, API matrix re-run (22/22), test-data cleanup, this report. |
| 7 | 2026-10-20 18:40 | **UX interaction pass** | `19fb950` | Click-to-edit cards, status badge cycling, pin/unpin with `isPinned` + `sortOrder` columns, drag-and-drop reordering via `PUT /api/notes/order`, pre-formatted multiline card body, header logo link, and a lobby that stays reachable while signed in. |

### Detail — milestone 4 (the integration)

1. Prisma installed and pinned to **6.x**. Prisma 7 was rejected: `@prisma/client@7` peer-requires
   TypeScript ≥ 5.4 and this project pins 5.2.2 (`ERESOLVE`).
2. `prisma/schema.prisma` authored for PostgreSQL; `prisma db push` synchronized `users` and
   `notes` to Neon; `prisma generate` produced the client.
3. Server modules added: `lib/prisma.ts` (singleton), `lib/auth.ts` (JWT + cookie), `lib/validation.ts`
   (zod), `lib/serializers.ts` (row → DTO), `lib/types.ts` (shared contract).
4. Six route handlers implemented, each reading the session before the body and scoping every query
   by `userId`.
5. Client swapped: `auth-context.tsx` now boots from `GET /api/auth/me`; the dashboard loads, creates,
   updates and deletes through the API with loading and inline error states.
6. Build hazards fixed: `/auth` wrapped in a `Suspense` boundary; legacy `localStorage` key purged on
   boot.
7. Verification executed against the live database, then a clean commit prepared for Vercel import.

---

## 3. Current Architectural State

### 3.1 Request flow

```
Browser (client component)
   │  fetch('/api/...', credentials: 'same-origin')
   ▼
Route Handler (runtime = nodejs, dynamic = force-dynamic)
   │  getSession()  ── reads HttpOnly cookie ──► jose.jwtVerify(HS256, JWT_SECRET)
   │  (401 if absent/expired)
   ▼
Prisma Client (lib/prisma.ts singleton)
   │  every WHERE includes userId
   ▼
Neon PostgreSQL (users, notes)
```

### 3.2 Directory structure

```
app/
  layout.tsx              server component; wraps the tree in <AuthProvider>
  auth-context.tsx        client auth state; /api/auth/me on boot; signIn/signUp/signOut/refreshUser
  page.tsx                landing page (presentational)
  auth/page.tsx           sign in / sign up form, Suspense-wrapped
  dashboard/page.tsx      notes grid, filter chips, search, create/edit dialog
  api/
    auth/register/route.ts   POST  – create account, set cookie (201 / 409)
    auth/login/route.ts      POST  – verify credentials, set cookie (200 / 401)
    auth/logout/route.ts     POST  – clear cookie
    auth/me/route.ts         GET   – current profile (200 / 401)
    notes/route.ts           GET   – list own notes; POST – create own note
    notes/[id]/route.ts      PUT   – update own note (404 otherwise); DELETE – delete own note
    notes/order/route.ts     PUT   – persist manual card order for the caller
lib/
  prisma.ts               PrismaClient singleton (globalThis guard)
  auth.ts                 JWT signing/verification, cookie name + options, nameFromEmail()
  validation.ts           zod schemas + firstIssue()
  serializers.ts          toNoteDTO(), toPublicUser()
  types.ts                NoteStatus, NoteDTO, PublicUser
prisma/schema.prisma      User, Note
```

### 3.3 Data model

| Model | Fields | Constraints |
| --- | --- | --- |
| `User` (`users`) | `id`, `email`, `name`, `passwordHash`, `createdAt` | `id` cuid PK; `email` unique; 1→N `notes` |
| `Note` (`notes`) | `id`, `title`, `content`, `status`, `isPinned`, `sortOrder`, `userId`, `createdAt`, `updatedAt` | `id` cuid PK; FK `userId` → `users.id`, `onDelete: Cascade`; index on `(userId, isPinned, sortOrder)`; `updatedAt` auto-maintained |

`status` is stored as **text**, not a Postgres enum, because the domain values `In-Progress` and
`On-Hold` contain hyphens, which Prisma enum identifiers cannot express. Values are enforced by
zod (`Todo | In-Progress | On-Hold | Done`) at the API boundary.

### 3.4 API surface

| Method | Route | Auth | Success | Failure modes |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | – | `201 {user}` + cookie | 400 invalid input, 409 duplicate email |
| POST | `/api/auth/login` | – | `200 {user}` + cookie | 400 invalid input, 401 bad credentials |
| POST | `/api/auth/logout` | – | `200 {ok}` + cleared cookie | – |
| GET | `/api/auth/me` | ✓ | `200 {user}` | 401 |
| GET | `/api/notes` | ✓ | `200 {notes[]}` | 401, 500 |
| POST | `/api/notes` | ✓ | `201 {note}` | 400, 401, 500 |
| PUT | `/api/notes/:id` | ✓ | `200 {note}` | 400, 401, 404, 500 |
| DELETE | `/api/notes/:id` | ✓ | `200 {ok}` | 401, 404, 500 |
| PUT | `/api/notes/order` | ✓ | `200 {ok, count}` | 400 (empty/duplicate ids), 401, 404 (foreign id), 500 |

Notes are serialized with `updatedAt` as **epoch milliseconds**, preserving the existing
`formatRelativeTime(ts: number)` helper unchanged.

### 3.5 Auth design

- Password hashed with bcrypt (cost 10); capped at 72 bytes by zod because bcrypt truncates silently.
- JWT: HS256, `{ userId, email }`, 30-day expiry, signed with `JWT_SECRET` (≥ 16 chars enforced).
- Cookie: `notelatte_session`, `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`.
- Login returns a single generic message for unknown email and wrong password (no account enumeration).
- Logout clears the cookie; tokens are stateless, so revocation is per-client (a stolen token stays
  valid until expiry — see backlog).
- Route protection is client-side only: `dashboard` redirects when the session resolves to null, and
  every API call independently enforces `401`.

### 3.6 Client state design

- `AuthProvider` exposes the original contract (`user`, `isLoading`, `signIn`, `signUp`, `signOut`)
  plus `refreshUser`. The three pages compile against the same field names as before the migration.
- `signIn` / `signUp` return `{ ok: true } | { ok: false, error }` and never throw across the
  boundary; the page renders `error` in its pre-existing red error block.
- Dashboard owns `notes` only as a cache of the server set; after each mutation the server-returned
  DTO replaces local state, so `id` and `updatedAt` are always server-authoritative.
- Filtering, search and per-status counts remain **client-side derivations** of the loaded set, which
  keeps the chip counters consistent without extra requests.
- Save failures keep the dialog open so typed content is not lost; delete is optimistic with rollback
  on non-2xx.

### 3.7 Card interaction model

- **Click-to-edit.** The whole `<article>` opens the edit dialog. Inner controls (status badge,
  pin, edit, delete) call `stopPropagation`; the card also ignores clicks within 250 ms of a drag
  ending, so a drag never opens a dialog. `Enter`/`Space` on a focused card opens it, and key
  events from inner buttons stop at the button.
- **Status cycle.** Badge click advances `Todo → In-Progress → On-Hold → Done → Todo` via
  `PUT /api/notes/:id { status }`. Optimistic, with single-field rollback and the inline error
  banner on failure. A per-note sequence counter discards stale responses so rapid clicking
  cannot be overwritten by an earlier reply.
- **Pinning.** `isPinned` toggles through the same optimistic path. Sort key is
  `isPinned DESC, sortOrder ASC, updatedAt DESC`, so pinned cards always lead and keep their
  relative order; pinned cards get a filled pin control and a tinted surface.
- **Reordering.** HTML5 drag-and-drop, enabled only when no filter or search is active — "index
  in the visible subset" has no stable meaning otherwise. A drop reassigns local `sortOrder` and
  sends `PUT /api/notes/order { ids }`, which rewrites positions in one transaction. The server
  uses a raw `UPDATE` so `@updatedAt` does not fire and dragged cards keep honest timestamps.
- **Rendering.** Card bodies use `whitespace-pre-wrap break-words line-clamp-4`, so explicit
  newlines survive and long tokens wrap instead of overflowing.

---

## 4. Current Environment & Verification

### 4.1 Environment

| Component | Version / value |
| --- | --- |
| Node.js | 20.20.2 (installed at `~/.local/node`, added to `PATH` via `~/.bashrc`) |
| npm | 10.8.2 |
| Next.js | 13.5.1 |
| React | 18.2.0 |
| Prisma CLI / Client | 6.19.3 |
| TypeScript | 5.2.2 |
| bcryptjs / jose | 3.0.3 / 6.2.12 |
| Database | Neon PostgreSQL (`neondb`, pooled endpoint, `sslmode=require`) |
| Vercel CLI | 64.5.0 (installed, **not logged in**) |

### 4.2 Build verification — 2026-10-20 18:40 UTC+8

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | **Pass** — 0 errors |
| Lint | `npm run lint` | **Pass** — 0 warnings, 0 errors |
| Production build | `rm -rf .next && npm run build` | **Pass** — compiled, typed, 6 static pages generated |

Route manifest:

```
○ /                    3.63 kB      91.7 kB
○ /auth                3.48 kB      91.6 kB
○ /dashboard          47.3 kB       135 kB
λ /api/auth/login      λ /api/auth/logout   λ /api/auth/me
λ /api/auth/register   λ /api/notes         λ /api/notes/[id]
λ /api/notes/order
```

`○` = prerendered static, `λ` = server-side rendered at runtime. **Zero TypeScript, lint or
packaging errors.**

> Note: `next.config.js` sets `eslint.ignoreDuringBuilds: true`, so `next lint` is run separately —
> a green build alone would not prove lint cleanliness.

### 4.3 API verification against Neon — 52 assertions

Executed against the production build served locally on port 3100 with the real `DATABASE_URL`.

| Group | Assertions | Result |
| --- | --- | --- |
| Registration | create (201), duplicate email (409) | Pass |
| Session | `/me` authenticated (200), after logout (401) | Pass |
| Notes CRUD | create (201), list (1), `updatedAt` is integer, update (200), delete (200), list empty after delete | Pass |
| Validation | blank title (400), invalid status (400) | Pass |
| Authorization | second account sees 0 notes, PUT on foreign id → 404, DELETE on foreign id → 404, owner's note intact | Pass |
| Unauthenticated | GET/POST `/api/notes` → 401, `/api/auth/me` → 401 | Pass |
| Credentials | wrong password (401, generic message), correct password (200) | Pass |

Interaction pass (2026-10-20 18:40) — 30 assertions:

| Group | Assertions | Result |
| --- | --- | --- |
| Ordering defaults | `sortOrder` −1/−2/−3 per create, newest first, `isPinned` false by default | Pass |
| Status | update 200 + persisted, sibling fields untouched, invalid value 400 | Pass |
| Pinning | toggle persisted, pinned card leads the list, unpinned relative order preserved | Pass |
| Reorder | `PUT /api/notes/order` 200, new order reflected, `updatedAt` byte-identical, `sortOrder` rewritten 0..1 | Pass |
| Reorder validation | duplicate ids 400, empty array 400, unauthenticated 401 | Pass |
| IDOR on new endpoints | foreign reorder 404, foreign pin 404, foreign status 404, second account sees nothing | Pass |
| Cleanup | three deletes 200, list empty | Pass |

### 4.4 UI verification (real browser)

signup → dashboard → create note → **hard reload (note returned from Postgres)** → edit → delete →
logout → deep-link `/dashboard` while signed out redirects to `/`. Screenshots confirmed the
styling is byte-for-byte the approved design (same Tailwind classes, same palette, same spacing).

Interaction pass, same session:

| Check | Observed |
| --- | --- |
| Multiline body | seeded `\n`-separated content renders on separate lines, clamped at four with ellipsis |
| Badge click | status advanced Todo → In-Progress, chip counts updated, **no dialog opened** |
| Badge click while card is clickable | inner `stopPropagation` verified — dialog stayed closed |
| Pin | card jumped to first position, `aria-pressed=true`, tinted surface + filled pin |
| Card body click | modal opened with title/status/content prefilled |
| Delete icon | note removed, **no dialog opened** |
| Drag & drop | Gamma dragged after Alpha → order `Beta, Alpha, Gamma`, still identical after a hard reload |
| Header logo | navigated to `/` and the lobby rendered for a signed-in user (after removing the old auto-redirect), with "Open Dashboard" in the header |

### 4.5 Data hygiene

- Verification uses throwaway accounts with timestamped `@example.com` addresses, deleted
  afterwards by explicit email list — never a table truncation.
- Current database contents: **2 accounts, 7 notes** (real usage created after handover).
  Preserved as-is.

---

## 5. Deployment Readiness (Vercel)

**Status: ready.** The repository is committed and clean; `npm run build` (which runs
`prisma generate && next build`) succeeds from a cold cache.

Required environment variables, for **Production, Preview and Development**:

```
DATABASE_URL   # Neon pooled connection string
JWT_SECRET     # openssl rand -base64 48
```

Steps:

1. `git push origin main`
2. Import the repository at vercel.com → Add New → Project (framework auto-detected as Next.js).
3. Add both environment variables for all three environments.
4. Deploy. `prisma db push` has already been applied to this database; no build-time migration step
   is needed.

CLI alternative:

```bash
vercel login
vercel link
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel --prod
```

The Vercel CLI is installed but **logged out** in this environment, and no `VERCEL_TOKEN` is
present, so deployment was deliberately not initiated. Publishing the private source tree to an
anonymous temporary deployment (which would carry no environment variables) was rejected as a
false-positive readiness signal.

---

## 6. Known Gaps / Backlog

| Priority | Item | Notes |
| --- | --- | --- |
| Medium | No `middleware.ts` route gate | A signed-out visitor can load the dashboard HTML shell before the client redirect fires. No data is exposed (all APIs return 401), but an edge gate would remove the flash. Requires `JWT_SECRET` on the edge runtime. |
| Medium | Stateless sessions cannot be revoked | A leaked cookie stays valid up to 30 days. A `Session` table (hashed token, `expiresAt`) enables revoke-all on logout/password change. |
| Medium | No login rate limiting | Add per-IP/email throttling before public launch. |
| Low | `prisma db push` instead of migration history | Acceptable for a prototype; switch to `prisma migrate` before multi-developer or multi-environment work. |
| Low | No committed test suite | The 22-assertion smoke matrix runs from an external script; porting it into `scripts/` + CI would protect the IDOR guarantees. |
| Low | Dead scaffold weight | `netlify.toml` + `@netlify/plugin-nextjs` are unused on Vercel; ~39 unused `components/ui/*` files and 10 unused dependencies remain from the template. |
| Low | `@types/bcryptjs` is redundant | bcryptjs 3 ships its own types; kept per explicit request. |
| Low | `metadataBase` warning at build | Cosmetic; set in `app/layout.tsx` once a canonical URL exists. |
| Low | Drag reorder only in the unfiltered view | Deliberate: reordering a filtered subset has no stable index semantics, so the handle is hidden while a filter/search is active. |
| Low | Card is a `role="button"` containing real buttons | Screen readers can flatten the inner controls. A dedicated "open" affordance would be stricter ARIA; current behaviour is correct for mouse and keyboard. |
| Info | Missing product features | Password reset, email verification, note sharing, pagination. |

---

## 7. Document Control

- This file is the running engineering changelog for NoteLatte.
- **Update rule:** append to §2 Milestones and refresh §4 verification results at the end of every
  milestone (schema change, feature, deployment), then update the header date and status. Do not
  rewrite history in §2 — supersede entries instead.
- Verification claims must correspond to commands actually executed in the current working tree;
  record the date alongside the result.

*Prepared 2026-10-20 18:20 UTC+8.*
