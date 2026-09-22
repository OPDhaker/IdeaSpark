# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

IdeaSpark 3.0 — registration + evaluation site for a Founders Club (SRM) event. Teams of 2–4 students register, pick a track, submit an idea per evaluation round, pay a fee after acceptance, then get scanned for attendance and scored by judges.

- **Neon project ID**: `misty-bar-11164765` (use the Neon MCP tools against this project)
- **Figma**: https://www.figma.com/design/V1JYydsq1dZd5CvYRvZUqP/IdeaSpark?node-id=1-2
- The codebase is mid-cleanup. Backend (`src/db`, `src/app/actions.ts`, payment routes) is fairly complete; most frontend routes are stubs. See **Cleanup backlog** below before adding anything new.

## Commands

Package manager is **bun**. Env vars live in **Doppler**, not in a local `.env` — every command that touches the DB or auth must be wrapped in `doppler run --`.

```bash
doppler run -- bun dev          # dev server (the normal start command)
bun run build                   # next build
bun run lint                    # biome check (lint + format + import sort)
bun run format                  # biome format --write

doppler run -- bun run db:generate   # drizzle-kit generate — new migration from src/db/schema.ts
doppler run -- bun run db:migrate    # apply migrations in ./drizzle
doppler run -- bun run db:push       # push schema straight to the branch (dev only)
doppler run -- bun run db:seed       # scripts/seed.ts — departments, tracks, event_config, bootstrap admin
doppler run -- bun run db:verify     # scripts/verify-db.ts — asserts the 13 expected tables exist
```

No test framework is installed. `bun run db:verify` (and `scripts/verify-db.sql` for indexes/constraints) is the only automated check beyond `lint` and `build`.

## Next.js 16 specifics

Read `node_modules/next/dist/docs/` before writing route code — this version differs from older Next.

- **`proxy.ts` replaces `middleware.ts`, and it lives at `src/proxy.ts`.** It must sit at the same level as `app` — because this repo uses `src/app`, a `proxy.ts` at the repo root is silently ignored and nothing is guarded. It calls `auth.middleware({ loginUrl: "/login" })` and guards `/register`, `/account`, `/dashboard`, `/panel`, `/admin`. It proves only that a visitor is *signed in* — it has no concept of roles, so `/panel` and `/admin` each carry a server-side `requireAdminRole` / `isAdmin` check in their own `layout.tsx`.
- Layout/page prop types come from **globally generated types** (`LayoutProps<"/">`, `LayoutProps<"/playbook">`) — do not hand-write `{ children }: { children: React.ReactNode }`.
- `pageExtensions` includes `mdx`, so a `page.mdx` is a real route file. Tailwind v4 (CSS-first, `@import "tailwindcss"` + `@theme inline` in `src/app/globals.css`) — there is no `tailwind.config.ts`.

## Design → code (Figma)

Figma file: `V1JYydsq1dZd5CvYRvZUqP`. Pull nodes with `get_design_context` (load the `figma-design-to-code` skill first), then translate — never paste the generated Tailwind verbatim.

- **Icons: always use `lucide-react`, never the Figma-exported SVG.** Figma names its icon layers after Lucide (`lucide/sparkles`), so map the layer name to the component: `lucide/sparkles` → `<Sparkles />`, `lucide/arrow-right` → `<ArrowRight />`. Size with `className="size-[Npx]"` from the Figma frame; the icon inherits `currentColor`. Only download an exported asset when the layer is real artwork, not an icon.
- **Colors come from the `globals.css` tokens, not hex literals.** The Figma variables map 1:1 onto light-mode vars: `custom/color/foreground` `#101a1b` = `--foreground`, `custom/color/background` `#f0eeeb` = `--background`, `custom/color/primary` `#44693c` = `--primary`. So `bg-primary` / `text-background` / `border-foreground`.
- **Every section is width-capped with `max-w-section`** (`--container-section: 1152px` in the `@theme inline` block = the 1280 Figma canvas minus its 64px side padding). The `<section>` keeps the full-bleed background and side padding; an inner `mx-auto w-full max-w-section` wrapper holds the content. `src/components/landing/hero.tsx` is the reference implementation; the remaining landing sections still need it.
- Tracking from Figma is given in px against a fixed font size — convert to `em` (`-7.68px` at `128px` → `tracking-[-0.06em]`) so it survives a responsive `clamp()`.
- Figma designs only ship a 1280 desktop frame. Mobile behaviour is ours to invent: stack, hide decorative vertical labels, fade background art behind the content.

## Architecture

### Route groups (`src/app`)
Groups map to audiences, and to the `proxy.ts` matcher:

| Group | Routes | Audience |
|---|---|---|
| `(publicRoutes)` | `/login`, `/tracks`, `/playbook` | anyone |
| `(publicRoutes)`, gated | `/register` | signed-in, teamless (redirects to `/dashboard` once a team exists) |
| `(teamRoutes)` | `/dashboard`, `/dashboard/team-details`, `/dashboard/leaderboard` | signed-in team leader |
| `(panelRoutes)` | `/panel`, `/panel/[round]`, `/panel/[round]/leaderboard` | evaluators |
| `(adminRoutes)` | `/admin`, `/admin/panels`, `/admin/event` | admins (the two sub-routes are `super_admin` only) |

`/` is the landing page, composed from `src/components/landing/*`. It is **dynamic**, not static: `getCtaState()` (`src/lib/auth/cta.ts`) picks the primary CTA per visitor — `Log In` / `Register` / `Dashboard` — and `page.tsx` passes one `ctaState` down to `Navbar`, `Hero` and `CtaBanner`. It first checks for a `NEON_AUTH_COOKIE_PREFIX` cookie and returns early, because `auth.getSession()` costs a ~300ms upstream round trip **even when nobody is signed in**; skipping it keeps anonymous TTFB at ~17ms. Don't replace that check with a bare `getSession()`.

### Auth: Neon Managed Better Auth
- `src/lib/auth/server.ts` — `createNeonAuth()`, needs `NEON_AUTH_BASE_URL` + `NEON_AUTH_COOKIE_SECRET` (throws at import if missing).
- `src/app/api/auth/[...path]/route.ts` — re-exports `auth.handler()`; all auth traffic proxies through it.
- `src/lib/auth/client.ts` — `authClient` for browser-side `signIn.social()` / `getSession()`.
- OAuth redirect URIs are **per Neon branch**: `{NEON_AUTH_BASE_URL}/callback/{provider}`. Details in `docs/backend/auth.md`.

Login flow: `/login` is the only sign-in screen and Google is the only method. The `callbackURL` passed to `signIn.social()` is `/register` — **never `/login`**, because the middleware short-circuits its own login path with `allow` *before* it exchanges the OAuth verifier, and it only runs the exchange on paths in the matcher. `/register` then redirects to `/dashboard` when the leader already has a team. The middleware does not preserve the originally requested path, so there is no automatic bounce-back after login.

Identity model: **only the team leader has an auth identity.** `teams.leadUserId` is the Neon Auth user id; other members are plain rows in `members` with no login. Admins are a separate table keyed by email — `src/lib/roles.ts` resolves the session email to an `admins` row, so admin access = "session email exists in `admins`".

### Data + mutation layers
Four distinct layers; keep them separate:

1. `src/db/schema.ts` — single source of truth. Invariants live in the DB as `check`/`unique`/partial-unique constraints, not only in TS.
2. `src/db/transactions.ts` — every multi-step or concurrency-sensitive write. Uses `pg_advisory_xact_lock(hashtext(teamId))` + `SELECT … FOR UPDATE` so concurrent roster/payment writes can't race. **Any new write that touches more than one row belongs here, not in an action.**
3. `src/app/actions.ts` — the `"use server"` surface. Does auth (`requireLead` / `requireAdminRole`), deadline checks (`assertBefore`), calls into the transaction layer, writes `audit_log` via `log()` (`src/lib/audit.ts`), then `revalidatePath()`. Most app logic still funnels through this one file; `src/actions/panel.ts` is the first domain split off it.
4. `src/db/queries.ts` — the read layer. Used by `actions.ts` and `src/actions/panel.ts`; it still overlaps `actions.ts` in places (see backlog).

`src/db/index.ts` exports a module-level `@neondatabase/serverless` `Pool` + drizzle `db`; throws at import if `DATABASE_URL` is unset. Scripts import it directly and must `await pool.end()`.

**`drizzle.config.ts` must keep `schemaFilter: ["public"]`.** Without it drizzle-kit treats every schema in the database as its own and a `db:push` proposes dropping `neon_auth` — the Managed Better Auth tables holding users, sessions, accounts and jwks. Confirming that prompt destroys every login.

`scripts/*.ts` run under `bun`, not `tsx`: tsx compiles them as CJS and both scripts use top-level `await`, which fails to transform.

### Business invariants (enforced in DB *and* transaction layer)
- Team size 1–3, leader included; exactly one leader (`one_leader_per_team` partial unique index). `src/lib/team-size.ts` is the single source, and the ceiling is also enforced in Postgres by `team_member_limit_trigger`.
- **Payment locks the roster** — `addMemberAtomically` / `removeMemberAtomically` reject once `teams.paymentStatus = 'paid'`. Removal also refuses to drop the leader or go below 1 member.
- Attendance codes are minted **only on successful payment**, in one bulk `UPDATE … SET attendance_code = gen_random_uuid()` inside the payment transaction — never per-member in a loop.
- Payment is gated on an `accepted` submission; amount always comes from `event_config.registrationFee`, never the client.
- `event_config` is a singleton (`id = 1`, enforced by check constraint); at most one active `evaluation_rounds` row (partial unique index).
- Leaderboard counts only teams that are both `approved` and `paid`.
- **The team leaderboard is published, not scheduled.** `event_config.leaderboard_published` is a switch a super admin flips at `/admin/event`; no date is involved. Scores arrive one judge at a time while a round runs, so a date-driven unlock would show a half-judged board, and when judging is *finished* is a call made in the room. `/panel/[round]/leaderboard` is deliberately **not** gated by it — judges need theirs live. That is the only reason the two boards differ.
- Attendance is one row per `(member_id, event_date)`; scores one row per `(team, round, evaluator)` and upsert on conflict.
- **Scoring is a four-criterion rubric out of 50** — Problem Understanding /15, Idea Feasibility /10, Decision Making /15, Coordination /10, each with its own `check`. `scores.score` is `GENERATED ALWAYS` as their sum, so it can never be written directly and can never disagree with its parts. `SCORE_CRITERIA` / `SCORE_MAX` in `src/db/schema.ts` are the single source for labels and maxima — derive UI from them, don't retype the numbers.
- **A judge sits on exactly one panel** (`panel_members.admin_id` is unique), and **a team has exactly one panel per round** (`team_panel_assignments` unique on `(team_id, round_id)`). A team's score is its panel's *per-criterion* mean, summed.
- A panel may only score a team that is assigned to it for that round, is `accepted` and `paid`, **and** has a member scanned into `attendance` on that round's `event_date`. All four are re-checked inside `upsertPanelScoreAtomically`.
- **`super_admin` sees everything and writes nothing extra.** They get every panel, every queue and every score, but the write gates above are not relaxed for them: saving a score still means sitting on that team's panel. A super admin who is not on it gets a read-only sheet. This keeps a team's mean exactly its panel's mean — an admin looking into a team cannot accidentally become a voice in its score.
- `evaluation_rounds.event_date` must be `event_config.day_one` or `day_two`. A `check` cannot reach across tables, so that one is enforced in `createEvaluationRound`, the way `scanAttendance` validates a scan date.

### Razorpay payment flow
Three server entry points, all `runtime = "nodejs"` (Node crypto):
- `POST /api/payments/verify` — client-return path. Verifies `orderId|paymentId` HMAC, and scopes the lookup by `teams.leadUserId = session user` so a leader can only finalize their own order.
- `POST /api/webhooks/razorpay` — authoritative path. Reads `await request.text()` **before** any JSON parse (Razorpay signs the exact raw body), verifies `x-razorpay-signature`, and only acts on `payment.captured`. Unknown orders are acked without mutating state.
- `POST /api/payments/verifywebhook` — legacy alias that re-exports the webhook `POST`.

Both finalize through `markPaymentPaid*Atomically`, which is idempotent (returns early if already `paid`). Signature comparison uses `timingSafeEqual` in `src/lib/razorpay.ts` — keep it that way.

### Judging panel (`/panel`)
The only place a score is written. `/admin` has no scoring form — one code path means one rubric and no way to bypass panel assignment.

- `/panel` — round picker, plus who is on your panel. `/panel/[round]` — the sheet, with the selected team in `?team=`. `/panel/[round]/leaderboard` — the live board, **no** day-one gate (judges need it during the round; teams don't get it until day one).
- `[round]` is `evaluation_rounds.slug` (`isd-1`, `isd-2`), not the sequence number or the UUID.
- `src/actions/panel.ts` is the whole server surface; `getPanelSheet()` returns **one shape** for every state (no round / no panel / empty queue / a team) so pages narrow on the fields rather than on which branch ran. It carries `canScore` per team — the UI reads that rather than re-deriving the rule.
- A `super_admin` gets a panel switcher (`?panel=<id>` or `?panel=all`); `getPanelQueue({ panelId: null })` is the unscoped view and left-joins the assignment, so it lists unassigned teams too.
- Prev/next walk the queue **A–Z and skip nothing**, so a judge's position never moves under their hand as they save. "Next unscored" is a separate, deliberate jump. The `<ScoreSheet>` is keyed on team id so one team's draft can't leak onto the next.
- Peer scores are always visible, by design — the panel deliberates together.

### Admin (`/admin`)
A sidebar shell in `admin/layout.tsx`, matching `/dashboard` and `/panel`. The layout resolves the actor with `getAdminActor()` and filters the nav by role, but **hiding a row is presentation only** — every page re-runs `requireAdminRole`, so typing the URL hits the same refusal.

- `/admin` — the control room: teams, review, attendance, announcements. Still one ~475-line client component; splitting it is a backlog item.
- `/admin/panels` — panel CRUD, judge rosters, per-round team assignment. `super_admin`.
- `/admin/event` — the leaderboard publish switch. `super_admin`.

### Playbook (`/playbook`)
A self-contained mini-site: vendored `typeset.css`, a TOC and a "Copy page" toolbar in `_components/`. **`page.mdx` is the only copy of the content** — it is plain GFM with no imports, exports or JSX, so `playbook.md/route.ts` serves that same file at `/playbook/playbook.md`; only `_content/llms.txt` is a separate, hand-written index. The copy comes from `public/IDEASPARK 3.docx`, which is what to reconcile against when event details change. See its own `README.md`.

## Cleanup backlog

Known breakage and duplication — fix these rather than building around them:

- **`.env.example` says `DATABASE_DIRECT_URL`, `drizzle.config.ts` reads `DIRECT_DATABASE_URL`.** Pick one name and fix the other.
- **`src/db/queries.ts` overlaps `actions.ts`** (`getDepartments`, `getActiveTracks` vs `getTracks`). Route the remaining reads through it or drop the duplicates.
- **`better-auth` is in `package.json` but unused** — auth goes through `@neondatabase/auth`.
- **`src/lib/index.ts` is a pointless re-export** of `@/db`; import from `@/db` directly.
- **Stub page**: `/event-details` has no `page.tsx` at all — the route is gone until the copy lands.
- `src/app/globals.css` defines `--font-sans: var(--font-sans)` (self-referential); the real font vars from `layout.tsx` are `--font-inter-sans` and `--font-instrument-serif`.
- No sign-out anywhere in the app, and the navbar still reads "Log In" for an already signed-in user.
- `getAdminReviewData` hands **every admin role, including `volunteer`, every score row**. It should return only what the caller's role needs.
- `actions.ts` still mixes team, payment, admin, rounds and attendance concerns. Splitting it by domain is the main structural cleanup — `src/actions/panel.ts` is the pattern to follow.
