# NoteLatte

A minimalist, Notion-style notes app. Next.js 13 App Router, Tailwind + shadcn/ui, Prisma
against PostgreSQL (Neon), and cookie-based JWT auth.

## Stack

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Framework | Next.js 13.5 (App Router, route handlers)                     |
| Styling   | Tailwind CSS 3 + shadcn/ui (Radix primitives)                 |
| Database  | PostgreSQL (Neon) via Prisma 6                                |
| Auth      | Email + password (bcrypt), HS256 JWT in an HttpOnly cookie (`jose`) |
| Validation| zod, shared by API routes                                      |

## 💾 Data Lifecycle & Storage Architecture

NoteLatte runs in two mutually exclusive modes. The interface, components and styling are
identical; only the storage driver behind the page changes.

| | Anonymous / Guest Mode | Cloud Authenticated Mode |
| --- | --- | --- |
| Trigger | No session cookie (first visit, signed out, or private window) | Valid `notelatte_session` JWT |
| Storage | Browser `localStorage`, key `notelatte_guest_notes` | PostgreSQL (Neon) via Prisma |
| Code path | `guestNotesDriver` — no network | `cloudNotesDriver` → `/api/notes`, `/api/notes/order` |
| Latency | Zero: reads and writes are local and synchronous | One round trip per mutation |
| Durability | This browser profile only | Survives reloads, restarts and redeploys |
| Devices | Single device, single browser | Every device signed into the account |
| Sync | None | Same account sees the same rows everywhere |
| Isolation | None — anyone with access to the device can read the payload | bcrypt password, HttpOnly JWT, every query scoped by `userId` (foreign ids return 404) |
| Limits | ~5 MB `localStorage` quota | Server-side zod validation, 200-char titles, 20k content |

### Guest Mode lifecycle

1. Opening `/dashboard` without a session seeds four example notes into
   `localStorage["notelatte_guest_notes"]` (only when the key is absent or unreadable).
2. Every action — create, edit, status cycle, pin, delete, drag reorder — is intercepted by
   `guestNotesDriver` and written straight back to `localStorage`. In this mode the page makes
   **no request to `/api/notes` or `/api/notes/order`**; the only API call is `/api/auth/me`, which
   is how the app learns whether a session exists.
3. Deliberately emptying the grid keeps it empty; the seed data is not re-created on every load.
4. Clearing browser data or cache, switching browsers, or closing a private window permanently
   destroys guest notes. There is no backup and no recovery path.

### Promotion to a cloud account

Signing in never silently uploads local data. If guest notes exist when an account becomes
active, the dashboard offers a one-time **Import notes** prompt: importing copies each note into
the account (title, body, status and pin preserved, confirmed server-side per note) and then
clears the local copy. Dismissing leaves everything local.

### Cloud mode lifecycle

Requests carry the HttpOnly session cookie. Every query filters on `userId` inside the `WHERE`
clause, so another account's note id returns `404` rather than `403` (no existence leak).
Passwords are bcrypt hashes; sessions are stateless HS256 JWTs valid for 30 days, so signing out
clears the cookie but does not revoke an already-issued token.

## Local setup

```bash
npm install                       # also runs `prisma generate`
cp .env.example .env              # then fill in both values
npm run db:push                   # create/refresh tables in the database
npm run dev                       # http://localhost:3000
```

`.env`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
JWT_SECRET="<openssl rand -base64 48>"
```

`DATABASE_URL` may be a Neon pooled connection string. `JWT_SECRET` must be at least 16
characters; rotating it invalidates every existing session.

## Scripts

| Script              | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Dev server                                     |
| `npm run build`     | `prisma generate && next build`                |
| `npm start`         | Serve the production build                     |
| `npm run lint`      | ESLint (`next lint`)                           |
| `npm run typecheck` | `tsc --noEmit`                                 |
| `npm run db:push`   | Push the Prisma schema to the database         |
| `npm run db:studio` | Prisma Studio                                  |

## Layout

```
app/
  layout.tsx            root layout, wraps everything in <AuthProvider>
  auth-context.tsx      client auth state: /api/auth/me on boot, signIn/signUp/signOut
  page.tsx              landing page
  auth/page.tsx         sign in / sign up form
  dashboard/page.tsx    notes grid, filters, search, create/edit modal
  api/
    auth/register|login|logout|me/route.ts
    notes/route.ts              GET (list), POST (create)
    notes/[id]/route.ts         PUT (update), DELETE
    notes/order/route.ts        PUT (persist drag-and-drop order)
lib/
  prisma.ts             PrismaClient singleton
  auth.ts               JWT sign/verify, session cookie helpers
  validation.ts         zod schemas
  serializers.ts        DB rows -> JSON DTOs
  types.ts              shared client/server types
  note-order.ts         pinned-first comparator shared by both drivers
  notes-driver.ts       NotesDriver contract + cloud driver (authenticated API)
  guest-notes.ts        localStorage driver, seeding and import helpers
prisma/schema.prisma    User + Note models
```

### Data model

- `User`: `id` (cuid), unique `email`, `name`, `passwordHash`, `createdAt`.
- `Note`: `id` (cuid), `title`, `content`, `status`, `isPinned`, `sortOrder`,
  `createdAt`, `updatedAt`, `userId` → `User` with `onDelete: Cascade`.

`status` is stored as text (`Todo` | `In-Progress` | `On-Hold` | `Done`) because the UI values
contain hyphens, which Prisma enum identifiers cannot express. Values are enforced by zod at the
API boundary.

## API

| Method | Route                 | Auth | Notes                                       |
| ------ | --------------------- | ---- | ------------------------------------------- |
| POST   | `/api/auth/register`  | –    | 409 on duplicate email, sets session cookie |
| POST   | `/api/auth/login`     | –    | 401 on bad credentials, sets session cookie |
| POST   | `/api/auth/logout`    | –    | Clears the cookie                           |
| GET    | `/api/auth/me`        | ✓    | `{ user }`, 401 when signed out             |
| GET    | `/api/notes`          | ✓    | Only the caller's notes                     |
| POST   | `/api/notes`          | ✓    | Note is attached to the caller              |
| PUT    | `/api/notes/:id`      | ✓    | 404 unless `id` **and** `userId` match      |
| DELETE | `/api/notes/:id`      | ✓    | 404 unless `id` **and** `userId` match      |
| PUT    | `/api/notes/order`    | ✓    | Persists manual grid order from `{ ids[] }` |

Every note query filters on `userId` inside the query itself, so a note belonging to another
account is indistinguishable from one that does not exist (no IDOR, no existence leak).

Notes are returned with `updatedAt` as epoch milliseconds so the client's relative-time
formatter keeps working.

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel: **Add New → Project → Import** the repo. Framework preset: Next.js.
   Build command and output are detected; `npm run build` already runs `prisma generate`.
3. Add environment variables for **Production, Preview and Development**:
   - `DATABASE_URL`
   - `JWT_SECRET`
4. Deploy. Then, once per environment, run `npm run db:push` locally against that database
   (or `npx prisma migrate deploy` if you switch to migration files).

Node 18.18+ is required (declared in `engines`).

## Notes / known cleanup

- `netlify.toml` and `@netlify/plugin-nextjs` are leftovers from the Bolt template and are
  unused on Vercel.
- Many unused `components/ui/*` primitives and their dependencies (recharts, embla, cmdk, vaul,
  react-day-picker, react-hook-form) remain from the scaffold.
