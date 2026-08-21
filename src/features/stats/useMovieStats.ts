import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useLibraryQuery, type MovieLibraryEntry } from '@/features/movies/api/library'
import { MAEVA_USER_ID, VALENTIN_USER_ID } from '@/constants/people'

const moviesDb = (supabase as any).schema('movies')

const MONTHS_BACK = 6
const MAX_GENRES = 7
const RATING_VALUES = [ 1, 2, 3, 4, 5 ]

interface GenreCount {
    genre: string;
    count: number;
}

interface RatingCount {
    value: number;
    valentinCount: number;
    maevaCount: number;
}

interface MonthCount {
    label: string;
    count: number;
}

export interface MovieStats {
    moviesWatchedCount: number;
    showsWatchedCount: number;
    showsInProgressCount: number;
    toWatchCount: number;
    totalWatchedCount: number;
    episodesWatchedCount: number;
    valentinAverageRating: number | null;
    maevaAverageRating: number | null;
    byGenre: GenreCount[];
    otherGenresCount: number;
    ratingDistribution: RatingCount[];
    activityByMonth: MonthCount[];
}

function average(values: number[]): number | null {
    if (values.length === 0) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

function computeStats(library: MovieLibraryEntry[]): Omit<MovieStats, 'activityByMonth'> {
    const watched = library.filter((entry) => entry.isWatched)
    const moviesWatchedCount = watched.filter((entry) => entry.mediaType === 'movie').length
    const showsWatchedCount = watched.filter((entry) => entry.mediaType === 'tv').length
    const showsInProgressCount = library.filter((entry) => entry.isInProgress).length
    const toWatchCount = library.filter((entry) => entry.isWishlist).length
    const episodesWatchedCount = library.reduce((sum, entry) => sum + entry.episodesWatchedCount, 0)

    const allRatings = library.flatMap((entry) => entry.ratings)
    const valentinAverageRating = average(
        allRatings.filter((r) => r.userId === VALENTIN_USER_ID).map((r) => r.rating),
    )
    const maevaAverageRating = average(allRatings.filter((r) => r.userId === MAEVA_USER_ID).map((r) => r.rating))

    const genreCounts = new Map<string, number>()
    for (const entry of watched) {
        for (const genre of entry.genres) {
            genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
        }
    }
    const sortedGenres = Array.from(genreCounts, ([ genre, count ]) => ({ genre, count })).sort(
        (a, b) => b.count - a.count,
    )
    const byGenre = sortedGenres.slice(0, MAX_GENRES)
    const otherGenresCount = sortedGenres.slice(MAX_GENRES).reduce((sum, g) => sum + g.count, 0)

    const ratingDistribution: RatingCount[] = RATING_VALUES.map((value) => ({
        value,
        valentinCount: allRatings.filter((r) => r.userId === VALENTIN_USER_ID && r.rating === value).length,
        maevaCount: allRatings.filter((r) => r.userId === MAEVA_USER_ID && r.rating === value).length,
    }))

    return {
        moviesWatchedCount,
        showsWatchedCount,
        showsInProgressCount,
        toWatchCount,
        totalWatchedCount: moviesWatchedCount + showsWatchedCount,
        episodesWatchedCount,
        valentinAverageRating,
        maevaAverageRating,
        byGenre,
        otherGenresCount,
        ratingDistribution,
    }
}

const monthLabelFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' })

// A separate, dedicated query rather than folding this into `useLibraryQuery` — it's
// the only thing on this screen that needs `movies.events` at all, and only the last
// 6 months of it, so there's no reason to make the library's own (hot-path, loaded on
// every app open) query any heavier for this.
async function fetchActivityByMonth(): Promise<MonthCount[]> {
    const now = new Date()
    const windowStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1), 1)

    const { data, error } = await moviesDb
        .from('events')
        .select('occurred_at')
        .gte('occurred_at', windowStart.toISOString())

    if (error) throw error
    const occurredDates = (data as { occurred_at: string }[]).map((row) => new Date(row.occurred_at))

    return Array.from({ length: MONTHS_BACK }, (_, i) => {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1 - i), 1)
        const count = occurredDates.filter(
            (date) => date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth(),
        ).length
        return { label: monthLabelFormatter.format(monthDate), count }
    })
}

export function useMovieStats() {
    const libraryQuery = useLibraryQuery()
    const activityQuery = useQuery({ queryKey: [ 'movie-activity-by-month' ], queryFn: fetchActivityByMonth })

    const stats = useMemo<MovieStats>(() => {
        const base = computeStats(libraryQuery.data ?? [])
        return { ...base, activityByMonth: activityQuery.data ?? [] }
    }, [ libraryQuery.data, activityQuery.data ])

    return {
        stats,
        isLoading: libraryQuery.isLoading || activityQuery.isLoading,
        isError: libraryQuery.isError || activityQuery.isError,
        refetch: () => Promise.all([ libraryQuery.refetch(), activityQuery.refetch() ]),
    }
}
