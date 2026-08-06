import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MediaType, TmdbBrowseItem } from '@/types/tmdb'

// The `movies` schema isn't in src/types/database.ts (a stub scoped to `public`, see
// CLAUDE.md — regenerate rather than hand-edit it) — cast past the generic Database
// constraint and type each response by hand instead (`as` on `data` below, not `.returns<T>()`
// which TS refuses on an already-`any` chain).
const moviesDb = (supabase as any).schema('movies')

interface TitleRow {
    id: string;
    tmdb_id: number;
    media_type: MediaType;
}

interface LibraryEntryRow {
    id: string;
    title_id: string;
    is_wishlist: boolean;
}

interface LibraryQueryRow {
    id: string;
    is_wishlist: boolean;
    added_at: string;
    titles: { id: string; tmdb_id: number; media_type: MediaType; name: string; poster_url: string | null; release_date: string | null; total_episodes: number | null; genres: string[] | null };
    viewings: { viewed_at: string }[];
    episode_watches: { watched_at: string; season_number: number }[];
    ratings: { user_id: string; rating: number }[];
}

/** Shared "our list" state for a title — not per-user, see 0001_movies_schema.sql. */
export interface MovieLibraryEntry {
    libraryEntryId: string;
    titleId: string;
    tmdbId: number;
    mediaType: MediaType;
    name: string;
    posterUrl: string | null;
    releaseDate: string | null;
    isWishlist: boolean;
    addedAt: string;
    viewingsCount: number;
    lastViewedAt: string | null;
    /** TV only (0001_movies_schema.sql doesn't have this — see 0006_episode_watches.sql). */
    totalEpisodes: number | null;
    episodesWatchedCount: number;
    /** "Watched" for library-tab purposes: movies use `viewingsCount`, TV shows use
     * episode completion — except a show that has old-style viewings but no episode_watches
     * yet (marked watched before per-episode tracking existed) stays considered watched
     * until the user actually starts checking episodes on it, so shipping this feature
     * doesn't silently move already-watched shows out of "Vu". */
    isWatched: boolean;
    /** TV only — some episodes checked, but not all of them yet. Movies have no partial
     * state (a viewing is all-or-nothing), so this is always false for them. */
    isInProgress: boolean;
    /** For the stats screen's genre breakdown — cached on `titles`, see 0001_movies_schema.sql. */
    genres: string[];
    /** Personal, per-user (see 0001_movies_schema.sql) — the only non-shared field here. */
    ratings: { userId: string; rating: number }[];
}

async function fetchLibrary(): Promise<MovieLibraryEntry[]> {
    const { data, error } = await moviesDb
        .from('library_entries')
        .select(
            'id, is_wishlist, added_at, titles(id, tmdb_id, media_type, name, poster_url, release_date, total_episodes, genres), viewings(viewed_at), episode_watches(watched_at, season_number), ratings(user_id, rating)',
        )

    if (error) throw error

    return (data as LibraryQueryRow[]).map((row) => {
        const viewedDates = row.viewings.map((v) => v.viewed_at).sort()
        // Season 0 ("Épisodes spéciaux") never counts here — `titles.total_episodes` is
        // TMDB's own aggregate, which already excludes specials, so counting them here too
        // would inflate this past that total (surfaced as a "21/9" style badge) without ever
        // being required for `isWatched` to flip true.
        const regularEpisodeWatches = row.episode_watches.filter((w) => w.season_number !== 0)
        const episodeWatchedDates = regularEpisodeWatches.map((w) => w.watched_at).sort()
        const totalEpisodes = row.titles.total_episodes
        const episodesWatchedCount = regularEpisodeWatches.length
        const hasEpisodeTracking = episodesWatchedCount > 0
        const isWatched = row.titles.media_type === 'movie'
            ? row.viewings.length > 0
            : hasEpisodeTracking
                ? totalEpisodes !== null && episodesWatchedCount >= totalEpisodes
                : row.viewings.length > 0

        return {
            libraryEntryId: row.id,
            titleId: row.titles.id,
            tmdbId: row.titles.tmdb_id,
            mediaType: row.titles.media_type,
            name: row.titles.name,
            posterUrl: row.titles.poster_url,
            releaseDate: row.titles.release_date,
            isWishlist: row.is_wishlist,
            addedAt: row.added_at,
            viewingsCount: row.viewings.length,
            lastViewedAt: episodeWatchedDates.length
                ? (episodeWatchedDates[ episodeWatchedDates.length - 1 ] ?? null)
                : (viewedDates.length ? (viewedDates[ viewedDates.length - 1 ] ?? null) : null),
            totalEpisodes,
            episodesWatchedCount,
            isWatched,
            isInProgress: row.titles.media_type === 'tv' && hasEpisodeTracking && !isWatched,
            genres: row.titles.genres ?? [],
            ratings: row.ratings.map((r) => ({ userId: r.user_id, rating: r.rating })),
        }
    })
}

export function useLibraryQuery() {
    return useQuery({
        queryKey: [ 'movie-library' ],
        queryFn: fetchLibrary,
    })
}

// One `useLibraryQuery()` subscription + one O(1) map, shared by every card a screen
// renders — the alternative (each card calling `useLibraryQuery()` and `.find()`-ing
// itself) means N query observers and an O(N) scan per card on a library that's now in
// the hundreds. Search/browse/similar-titles rows use this; the library screen itself
// already has the resolved `MovieLibraryEntry` per row and doesn't need it.
export function useLibraryEntryLookup() {
    const libraryQuery = useLibraryQuery()

    return useMemo(() => {
        const map = new Map<string, MovieLibraryEntry>()
        for (const entry of libraryQuery.data ?? []) {
            map.set(`${entry.mediaType}-${entry.tmdbId}`, entry)
        }
        return map
    }, [ libraryQuery.data ])
}

// Upserts without `ignoreDuplicates` on purpose: with it, an upsert that hits an existing
// row does nothing and PostgREST returns no row for `.select()` to read back, so
// `.single()` blows up on every already-cached title. A plain (no-op on conflict) update
// still touches the row, so RETURNING always has something to hand back.
//
// `numberOfEpisodes` is only known once a caller has already fetched full TV details (the
// show/season detail screens, via `TmdbTitleDetails`) — plain `TmdbBrowseItem` callers
// (search/browse cards) don't have it, and omitting the key entirely (not passing `null`)
// means the upsert leaves a previously-cached value alone instead of clobbering it.
async function ensureTitle(item: TmdbBrowseItem & { numberOfEpisodes?: number | null }): Promise<TitleRow> {
    const { data, error } = await moviesDb
        .from('titles')
        .upsert(
            {
                tmdb_id: item.tmdbId,
                media_type: item.mediaType,
                name: item.title,
                poster_url: item.posterUrl,
                release_date: item.releaseDate,
                ...(item.numberOfEpisodes != null ? { total_episodes: item.numberOfEpisodes } : {}),
            },
            { onConflict: 'tmdb_id,media_type' },
        )
        .select('id, tmdb_id, media_type')
        .single()

    if (error) throw error
    return data as TitleRow
}

async function ensureLibraryEntry(titleId: string): Promise<LibraryEntryRow> {
    const { data, error } = await moviesDb
        .from('library_entries')
        .upsert({ title_id: titleId }, { onConflict: 'title_id' })
        .select('id, title_id, is_wishlist')
        .single()

    if (error) throw error
    return data as LibraryEntryRow
}

async function ensureLibraryEntryForItem(item: TmdbBrowseItem & { numberOfEpisodes?: number | null }): Promise<LibraryEntryRow> {
    const title = await ensureTitle(item)
    return ensureLibraryEntry(title.id)
}

// `viewings.viewed_at` defaults to `current_date` on the DB server, which runs in UTC —
// near local midnight that can silently record the wrong calendar day. Compute the
// device's actual local date instead of relying on that default.
function todayLocalDate(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function useToggleWishlist() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ item, isWishlist }: { item: TmdbBrowseItem; isWishlist: boolean }) => {
            const entry = await ensureLibraryEntryForItem(item)
            const { error } = await moviesDb.from('library_entries').update({ is_wishlist: isWishlist }).eq('id', entry.id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ 'movie-library' ] })
            // A wishlist toggle can log a 'wishlisted' event (see 0004_movies_events.sql's
            // trigger) — refresh the timeline too so it shows up without a manual pull-to-refresh.
            queryClient.invalidateQueries({ queryKey: [ 'movie-timeline' ] })
        },
    })
}

// Deletes the library_entries row outright — viewings/ratings/episode_watches/events all
// cascade (see their `on delete cascade` foreign keys in the migrations), no cleanup needed
// beyond this one delete. Doesn't touch movies.titles (the TMDB cache row): harmless to
// leave, and re-adding the same title later just reuses it via ensureTitle's upsert.
export function useRemoveFromLibrary() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (libraryEntryId: string) => {
            const { error } = await moviesDb.from('library_entries').delete().eq('id', libraryEntryId)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ 'movie-library' ] })
            queryClient.invalidateQueries({ queryKey: [ 'movie-timeline' ] })
        },
    })
}

// Deliberately not a toggle — every call inserts a new `viewings` row, so tapping
// "Vu"/"Revu" repeatedly builds up the actual watch history instead of just flipping a flag.
export function useMarkAsViewed() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (item: TmdbBrowseItem) => {
            const entry = await ensureLibraryEntryForItem(item)

            const insertViewing = moviesDb
                .from('viewings')
                .insert({ library_entry_id: entry.id, viewed_at: todayLocalDate() })
                .then(({ error }: { error: unknown }) => {
                    if (error) throw error
                })

            // Marking something as watched clears any pending wishlist flag — you can still
            // re-add it to the wishlist afterwards (e.g. "want to rewatch"), but watching it
            // isn't itself a reason to keep it marked as "want to watch".
            const clearWishlist = entry.is_wishlist
                ? moviesDb
                    .from('library_entries')
                    .update({ is_wishlist: false })
                    .eq('id', entry.id)
                    .then(({ error }: { error: unknown }) => {
                        if (error) throw error
                    })
                : Promise.resolve()

            await Promise.all([ insertViewing, clearWishlist ])
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ 'movie-library' ] })
            queryClient.invalidateQueries({ queryKey: [ 'movie-timeline' ] })
        },
    })
}

// Personal, 1-5 (see 0002_fix_ratings_scale.sql) — one row per (library_entry, user),
// upserted so re-rating just overwrites your previous score instead of stacking rows.
// Takes `userId` from the caller instead of calling `useAuth()` itself — every caller
// already has a session (it's needed to render "Ma note"), so a second internal Context
// subscription here would just be a duplicate read on every card that uses this hook.
export function useRateTitle() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ item, rating, userId }: { item: TmdbBrowseItem; rating: number; userId: string | undefined }) => {
            if (!userId) throw new Error('Not authenticated')
            const entry = await ensureLibraryEntryForItem(item)

            const { error } = await moviesDb
                .from('ratings')
                .upsert(
                    { library_entry_id: entry.id, user_id: userId, rating },
                    { onConflict: 'library_entry_id,user_id' },
                )
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ 'movie-library' ] })
        },
    })
}

// Shared, like the rest of this schema — either person checking an episode marks it for
// both (0006_episode_watches.sql). A season's watched state isn't part of `fetchLibrary`'s
// per-title query (that only needs the total count, not which episodes) — fetched
// separately, per season, only when the season screen is actually open.
//
// Returns a plain array, not a `Set` — this result goes through the AsyncStorage-persisted
// query cache (see queryPersister.ts), which round-trips through `JSON.stringify`/`parse`.
// A `Set` has no enumerable own properties, so it serializes to `{}` and rehydrates as a
// plain object with no `.has()` — surfaces as "watchedEpisodes.has is not a function" after
// an app restart, even though the underlying data was written fine. Callers build their own
// `Set` from this array at render time instead (see season/[id].tsx).
async function fetchEpisodeWatches(libraryEntryId: string, seasonNumber: number): Promise<number[]> {
    const { data, error } = await moviesDb
        .from('episode_watches')
        .select('episode_number')
        .eq('library_entry_id', libraryEntryId)
        .eq('season_number', seasonNumber)

    if (error) throw error
    return (data as { episode_number: number }[]).map((row) => row.episode_number)
}

// `libraryEntryId` is `null` until the title has ever been added to the library (wishlist,
// rated, or a first episode checked) — nothing to fetch yet in that case, every episode
// just renders unchecked.
export function useSeasonWatchesQuery(libraryEntryId: string | null, seasonNumber: number) {
    return useQuery({
        queryKey: [ 'episode-watches', libraryEntryId, seasonNumber ],
        queryFn: () => fetchEpisodeWatches(libraryEntryId as string, seasonNumber),
        enabled: libraryEntryId !== null,
    })
}

// Every checked episode across every season of a show — the show detail screen needs this
// to mark which seasons are complete and which one to highlight as "current", which a
// single season's worth of data (`useSeasonWatchesQuery`) can't answer.
async function fetchShowWatches(libraryEntryId: string): Promise<{ seasonNumber: number; episodeNumber: number }[]> {
    const { data, error } = await moviesDb
        .from('episode_watches')
        .select('season_number, episode_number')
        .eq('library_entry_id', libraryEntryId)

    if (error) throw error
    return (data as { season_number: number; episode_number: number }[]).map((row) => ({
        seasonNumber: row.season_number,
        episodeNumber: row.episode_number,
    }))
}

export function useShowWatchesQuery(libraryEntryId: string | null) {
    return useQuery({
        queryKey: [ 'show-episode-watches', libraryEntryId ],
        queryFn: () => fetchShowWatches(libraryEntryId as string),
        enabled: libraryEntryId !== null,
    })
}

export function useToggleEpisodeWatched() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            item,
            seasonNumber,
            episodeNumber,
            watched,
        }: {
            item: TmdbBrowseItem & { numberOfEpisodes?: number | null };
            seasonNumber: number;
            episodeNumber: number;
            watched: boolean;
        }) => {
            const entry = await ensureLibraryEntryForItem(item)

            if (watched) {
                const { error } = await moviesDb
                    .from('episode_watches')
                    .upsert(
                        { library_entry_id: entry.id, season_number: seasonNumber, episode_number: episodeNumber },
                        { onConflict: 'library_entry_id,season_number,episode_number' },
                    )
                if (error) throw error
            } else {
                const { error } = await moviesDb
                    .from('episode_watches')
                    .delete()
                    .eq('library_entry_id', entry.id)
                    .eq('season_number', seasonNumber)
                    .eq('episode_number', episodeNumber)
                if (error) throw error
            }

            return entry
        },
        onSuccess: (entry, variables) => {
            queryClient.invalidateQueries({ queryKey: [ 'episode-watches', entry.id, variables.seasonNumber ] })
            queryClient.invalidateQueries({ queryKey: [ 'show-episode-watches', entry.id ] })
            queryClient.invalidateQueries({ queryKey: [ 'movie-library' ] })
            // Only marking an episode (not un-marking) logs a timeline event — see
            // 0008_episode_watched_trigger.sql.
            if (variables.watched) {
                queryClient.invalidateQueries({ queryKey: [ 'movie-timeline' ] })
            }
        },
    })
}

// "Catch up" — marks several episodes of the same season watched in one go (e.g. checking
// episode 8 offers to also check 1-7). One upsert, so the trigger still logs one timeline
// event per episode (0008_episode_watched_trigger.sql fires per row), not a single
// "watched episodes 1-8" event.
export function useMarkEpisodesWatched() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            item,
            seasonNumber,
            episodeNumbers,
            watchedAt,
        }: {
            item: TmdbBrowseItem & { numberOfEpisodes?: number | null };
            seasonNumber: number;
            episodeNumbers: number[];
            /** Overrides the DB default (`now()`) — for backfilling a season you'd already
             * seen before per-episode tracking existed, so it doesn't jump to the top of
             * "Vu" as if you'd just watched it. Omit for genuine real-time catch-up
             * (e.g. checking episode 8 also checks 1-7 you just watched today). */
            watchedAt?: string;
        }) => {
            const entry = await ensureLibraryEntryForItem(item)

            const { error } = await moviesDb
                .from('episode_watches')
                .upsert(
                    episodeNumbers.map((episodeNumber) => ({
                        library_entry_id: entry.id,
                        season_number: seasonNumber,
                        episode_number: episodeNumber,
                        ...(watchedAt ? { watched_at: watchedAt } : {}),
                    })),
                    { onConflict: 'library_entry_id,season_number,episode_number' },
                )
            if (error) throw error

            return entry
        },
        onSuccess: (entry, variables) => {
            queryClient.invalidateQueries({ queryKey: [ 'episode-watches', entry.id, variables.seasonNumber ] })
            queryClient.invalidateQueries({ queryKey: [ 'show-episode-watches', entry.id ] })
            queryClient.invalidateQueries({ queryKey: [ 'movie-library' ] })
            queryClient.invalidateQueries({ queryKey: [ 'movie-timeline' ] })
        },
    })
}
