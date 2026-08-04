import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
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
    titles: { id: string; tmdb_id: number; media_type: MediaType; name: string; poster_url: string | null; release_date: string | null };
    viewings: { viewed_at: string }[];
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
    viewingsCount: number;
    lastViewedAt: string | null;
    /** Personal, per-user (see 0001_movies_schema.sql) — the only non-shared field here. */
    ratings: { userId: string; rating: number }[];
}

async function fetchLibrary(): Promise<MovieLibraryEntry[]> {
    const { data, error } = await moviesDb
        .from('library_entries')
        .select(
            'id, is_wishlist, titles(id, tmdb_id, media_type, name, poster_url, release_date), viewings(viewed_at), ratings(user_id, rating)',
        )

    if (error) throw error

    return (data as LibraryQueryRow[]).map((row) => {
        const viewedDates = row.viewings.map((v) => v.viewed_at).sort()
        return {
            libraryEntryId: row.id,
            titleId: row.titles.id,
            tmdbId: row.titles.tmdb_id,
            mediaType: row.titles.media_type,
            name: row.titles.name,
            posterUrl: row.titles.poster_url,
            releaseDate: row.titles.release_date,
            isWishlist: row.is_wishlist,
            viewingsCount: row.viewings.length,
            lastViewedAt: viewedDates.length ? (viewedDates[ viewedDates.length - 1 ] ?? null) : null,
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

// Upserts without `ignoreDuplicates` on purpose: with it, an upsert that hits an existing
// row does nothing and PostgREST returns no row for `.select()` to read back, so
// `.single()` blows up on every already-cached title. A plain (no-op on conflict) update
// still touches the row, so RETURNING always has something to hand back.
async function ensureTitle(item: TmdbBrowseItem): Promise<TitleRow> {
    const { data, error } = await moviesDb
        .from('titles')
        .upsert(
            {
                tmdb_id: item.tmdbId,
                media_type: item.mediaType,
                name: item.title,
                poster_url: item.posterUrl,
                release_date: item.releaseDate,
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

async function ensureLibraryEntryForItem(item: TmdbBrowseItem): Promise<LibraryEntryRow> {
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
export function useRateTitle() {
    const { session } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ item, rating }: { item: TmdbBrowseItem; rating: number }) => {
            if (!session?.user.id) throw new Error('Not authenticated')
            const entry = await ensureLibraryEntryForItem(item)

            const { error } = await moviesDb
                .from('ratings')
                .upsert(
                    { library_entry_id: entry.id, user_id: session.user.id, rating },
                    { onConflict: 'library_entry_id,user_id' },
                )
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ 'movie-library' ] })
        },
    })
}
