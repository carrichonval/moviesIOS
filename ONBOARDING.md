# Onboarding — Krokmo'vie (iOS)

Read this first, before touching anything. This project is a fresh clone of
`~/Projets/templateIOS` (which is itself extracted from `~/Projets/gameTracker`, a
working game-tracking iOS app by the same person) — `CLAUDE.md` and `README.md` in this
repo already explain the generic template mechanics (auth flow, session storage, feature
folder conventions, routing). This file only covers what's specific to *this* app: a
movie/TV tracker, built for the user and his girlfriend, backed by TMDB.

If `~/Projets/gameTracker` is reachable on this machine, it's worth reading directly —
it's the same person's actual shipped app and the pattern this one should follow "dans
les grandes lignes" (broad strokes, not necessarily every screen). Everything below is
written to be understandable without it too, in case it isn't reachable (different
machine/account).

## The most important thing: the sharing model

This app is for **two people** (a couple), not a general audience and not really
"per-user" in the way most apps are. Get this wrong and the data model breaks:

- **Wishlist status, watched status, and the viewing history are fully shared with zero
  attribution.** If either person adds a title, marks it watched, or toggles the
  wishlist, it changes identically for both — there is no "who did this" anywhere in
  this part of the data.
- **The one and only per-person thing is the rating.** Each person rates a title
  independently. Both ratings are visible to both people, but each person can only
  create/edit their own.

Concretely: `movies.library_entries` and `movies.viewings` have **no user column at
all** — don't add one, and don't copy gameTracker's `user_games` (`user_id = auth.uid()`
scoped) pattern onto them, that would be wrong here. Only `movies.ratings` is
per-user-scoped.

## Auth / users

Reuses the exact same shared Supabase project, `auth.users`, and `public.users` table
that gameTracker and every other of this person's personal apps use (see this project's
own `CLAUDE.md` — "Pas de migrations dans ce template" section). Don't create a new
`users` table. The girlfriend gets her own account there the normal way (sign up →
`handle_new_user()` trigger already creates her `public.users` row) — she is not a
special case in the schema, she's just the second person who happens to log in.

## Database: already created, don't recreate it

The `movies` Postgres schema and its tables **already exist live in Supabase** — the
user ran the SQL in `supabase/migrations/0001_movies_schema.sql` (in this repo) by hand
before this project existed. That file is there for reference/documentation, not to be
re-run.

Schema recap (full SQL with comments in that migration file):
- `movies.titles` — TMDB cache (tmdb_id, media_type, name, poster_url, release_date,
  overview, genres, `details_cached_at`). Deliberately does **not** store the full raw
  TMDB API response — cache only what the UI needs, fetch/refresh the rest live. This
  mirrors gameTracker's `public.games` + `details_cached_at` pattern exactly.
- `movies.library_entries` — the shared "our list" (title_id, is_wishlist, added_at).
  One row per title that's actually been added, separate from `titles` (which can also
  hold titles only ever looked up/searched, not added — same split as
  `games`/`user_games` in gameTracker).
- `movies.viewings` — one row per viewing event (library_entry_id, viewed_at). View
  count = `count(*)`, last viewed = `max(viewed_at)`. This also naturally doubles as an
  activity/history feed if that's ever wanted later (see gameTracker's `game_events` +
  its history screen for what that could look like — not required for v1).
- `movies.ratings` — per-person rating (library_entry_id, user_id, rating 1–10). RLS:
  anyone authenticated can read all ratings, but insert/update/delete are scoped to
  `user_id = auth.uid()`.

**One manual step to verify/do in the Supabase dashboard** (can't be done via SQL):
Project Settings → Data API → Exposed schemas → make sure `movies` is listed. Without
this, PostgREST won't serve it and every `supabase.schema('movies').from(...)` call will
404 — check this first if anything about titles/library/ratings/viewings 404s instead of
returning an RLS/auth error.

Client-side, every query against these tables needs `.schema('movies')` before `.from(...)`,
e.g. `supabase.schema('movies').from('titles').select()` — the default client
(`src/lib/supabase.ts`, unchanged from the template) still points at `public` by default.

Generate/refresh `src/types/database.ts` from the live schema once you're set up
(`supabase gen types typescript`, scoped to include the `movies` schema) rather than
hand-writing the types — same discipline as gameTracker.

## TMDB integration

Data source is TMDB (movies + TV) — same idea as gameTracker's IGDB integration
(`gameTracker/supabase/functions/igdb/`), one meaningful difference: TMDB's read-access
token is static (no OAuth refresh cycle like IGDB's Twitch token), so there's no need
for an equivalent of gameTracker's `igdb_token_cache` table. Otherwise, mirror the same
shape:
- A Supabase Edge Function holds the TMDB token as a server-side secret and proxies
  search/detail requests — the client never sees it.
- The app calls that function, not TMDB directly.
- Cache minimal fields into `movies.titles` on first add/search-result-select, refresh
  richer detail fields (cast, similar titles, etc.) live/on-demand, same as gameTracker's
  `refreshGameCache` does for IGDB.

## What to actually build (roughly, in the spirit of gameTracker, not a spec)

- TMDB search / browse → add to the shared list (movie or TV).
- The shared list, filterable by wishlist vs. watched, movie vs. TV.
- A detail screen: poster/overview (from TMDB, cached), mark-as-watched (inserts a
  `movies.viewings` row), wishlist toggle, both people's ratings.
- Whatever stats/history screens feel natural later — not required for v1.

Visual/DA conventions: reuse gameTracker's (dark-only palette — **do not** add a
light/system theme toggle, there's no light palette and a past attempt at this broke
every screen in that app; rounded-2xl cards, the accent/status color tokens, Skeleton
loading states, etc.) if `~/Projets/gameTracker` is reachable, otherwise just keep it
simple and dark and consistent — nothing mandates copying gameTracker pixel-for-pixel.

## Working style

- Confirm with the user before any destructive or hard-to-reverse database operation —
  this is real, live, precious data (a couple's actual movie/watch history).
- Don't over-engineer: no abstractions or config options beyond what's actually needed
  right now, no speculative future-proofing.
- Run `npx tsc --noEmit` after changes (no ESLint config in this template as of writing —
  check before assuming one exists).
- Adding a native module (anything beyond what's already in `package.json`) needs
  `npx expo install <pkg>` (auto-picks the SDK-compatible version) and a rebuild
  (`npx expo prebuild` / `npx expo run:ios`) before it'll work — `ios`/`android` folders
  are gitignored here (Continuous Native Generation), regenerated on demand.
- Ask before assuming scope on anything ambiguous rather than guessing — this person
  prefers being asked over having to correct a wrong assumption later.
