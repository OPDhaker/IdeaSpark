# Build backlog

Agreed 2026-09-21. Build order is the order below; one at a time.

Everything else in the participant → super_admin → evaluator flow is already
built (register → submit → in_review → accept/reject → pay → passes; panel
assignment, judging, leaderboard publish switch). These five are the gaps.

---

## 1. Hosted Razorpay payment link

Implemented on the accepted-team dashboard: it embeds the hosted Razorpay
Payment Page, then lets the leader submit the resulting payment ID. The ID is
stored in `teams.payment_id`; submission immediately marks the team paid and
mints attendance codes atomically. Payment IDs are unique across teams.

This flow does **not** verify payment IDs with Razorpay. A submitted ID is
self-reported and unlocks paid features immediately. No API keys, SDK, order
creation, or webhooks are used. The schema migration copies IDs from any
previously paid `payments` rows before removing the old table.

---

## 2. WhatsApp card (dashboard)

A card linking the team to the event WhatsApp group. Zero references to
"whatsapp" exist in `src/` today.

- Dashboard is currently TemplateCard (full width) + a 2-col row of ActionCard +
  TrackCard — `src/app/(teamRoutes)/dashboard/page.tsx`. Decide: third card in
  that row, or a new row.
- Use the `DashCard` / `CardTitle` / `CardBody` shell in `_components/panel.tsx`
  so it matches the rest.
- The invite URL needs a home. Simplest is a new `event_config` column alongside
  `submission_template_url`, set from `/admin/event` (see item 3) — same shape,
  same admin screen, no second pattern.
- Should it show before acceptance, or only after? Decide before building.

---

## 3. `/admin/event` — upload/set the template PPT link

Super_admin sets `event_config.submission_template_url` from the UI.

- Column exists: `src/db/schema.ts:435`. `getSubmissionState()` already reads it
  and `TemplateCard` already renders the null state ("Not posted yet"), so this is
  UI + action only.
- `updateEventConfig` (`src/app/actions.ts:743`) is the existing super_admin
  writer — extend it or add a sibling; `/admin/event` currently holds only the
  leaderboard publish toggle.
- "Upload" vs "paste link": pasting a Drive/Slides link is the no-infra option and
  matches how teams submit. A real file upload needs a blob store — decide first.

---

## 4. Tracks bento on `/tracks` — DONE

Shipped: `src/app/(publicRoutes)/tracks/page.tsx` reads `getActiveTracks()` and
renders `_components/track-bento.tsx` — MagicBento (reactbits.dev) rebuilt on
anime.js, with the glow reading `--primary` instead of an RGB-string prop.

Left over: the track icons are a name-keyed map in `track-bento.tsx` because
`tracks` has no icon column. A renamed track silently falls back to `Lightbulb`.

---

## 5. Real event details on `/event-details` — BLOCKED

There is no `src/app/(publicRoutes)/event-details/page.tsx` — the route does not
exist, and nothing links to it.

**Blocked on Vansh sending the copy.** Nothing to build until then.

When it arrives: `/playbook` already carries the same facts, sourced from
`public/IDEASPARK 3.docx`, in a single file —
`src/app/(publicRoutes)/playbook/page.mdx`. Update that and this page together,
or they drift.

---

## 6. Team-name duplicate check — case handling

**As asked:** the duplicate check on team names must be case sensitive.

**Current state:** it already is, by default. `teams.team_name` is
`varchar(255).notNull().unique()` (`src/db/schema.ts:84`), and Postgres compares
`varchar` case-sensitively — so `Drive` and `drive` are two different teams
today and both insert fine. The error surfaces in `createTeam` via
`uniqueViolationConstraint` matching `team_name` → "That team name is taken."
(`src/app/actions.ts:274`). There is no pre-check query; the DB constraint is
the only gate.

**So this is a no-op unless the intent was the opposite** — i.e. `Drive` and
`drive` should collide, which is what usually bites at a registration desk (two
teams, one name, different capitalisation). Confirm which before building.

If case-**insensitive** is what's wanted:
- Replace the plain unique with a functional unique index on `lower(team_name)`
  (drizzle: `uniqueIndex("teams_team_name_lower_unique").on(sql\`lower(...)\`)`),
  or move the column to `citext`. The index is the smaller change.
- Migration must dedupe any existing case-collisions first, or it won't build.
- `uniqueViolationConstraint` matches by substring, so a new constraint name
  containing `team_name` keeps the friendly field error working.
- Store the name as typed — only the comparison folds case.

## 7. `next/image` pointed at an unconfigured remote host

`src/app/(teamRoutes)/dashboard/_components/submit-form.tsx:73` renders the
Google Drive mark from `https://thesvg.org/icons/google-drive-2026/default.svg`,
but `next.config.ts` declares no `images.remotePatterns`. `next/image` refuses
any remote host that is not listed and throws at render:

> Invalid src prop (…) on `next/image`, hostname "thesvg.org" is not configured
> under images in your `next.config.js`

(`node_modules/next/dist/shared/lib/image-loader.js:101`.) So the submit card is
broken wherever it renders.

The login button had the same bug and was fixed by inlining the mark as an SVG
component (`src/app/(publicRoutes)/login/_components/google-mark.tsx`) — no
network hop, no layout shift, and no config surface to keep in sync. Do the same
here rather than whitelisting the host.
