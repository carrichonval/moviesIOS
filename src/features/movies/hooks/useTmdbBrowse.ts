import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
    getDiscoverTitles,
    getGenres,
    getPopularTitles,
    getRecentTitles,
    getSeasonDetails,
    getTitleDetails,
    getTitlesByGenre,
    getTopRatedTitles,
    searchTitles,
} from '@/services/tmdb'
import type { MediaType } from '@/types/tmdb'

const PREVIEW_LIMIT = 10
const TOP_RATED_PAGE_COUNT = 5 // 5 pages * 20 results = Top 100

interface QueryOptions {
    enabled?: boolean;
    mediaType?: MediaType;
}

export function usePopularTitles(options?: QueryOptions) {
    const mediaType = options?.mediaType ?? 'movie'
    return useQuery({
        queryKey: [ 'tmdb', 'popular', mediaType ],
        queryFn: async () => (await getPopularTitles({ mediaType })).items.slice(0, PREVIEW_LIMIT),
        enabled: options?.enabled,
    })
}

export function useRecentTitles(options?: QueryOptions) {
    const mediaType = options?.mediaType ?? 'movie'
    return useQuery({
        queryKey: [ 'tmdb', 'recent', mediaType ],
        queryFn: async () => (await getRecentTitles({ mediaType })).items.slice(0, PREVIEW_LIMIT),
        enabled: options?.enabled,
    })
}

export function useDiscoverTitles(options?: QueryOptions) {
    const mediaType = options?.mediaType ?? 'movie'
    return useQuery({
        queryKey: [ 'tmdb', 'discover', mediaType ],
        queryFn: async () => (await getDiscoverTitles({ mediaType })).items.slice(0, PREVIEW_LIMIT),
        enabled: options?.enabled,
    })
}

// Fetches all 100 up front (5 pages) rather than paginating on scroll — same approach
// gameTracker uses for its Top 100 row, since the list is capped and small enough to load whole.
export function useTopRatedTitles(options?: QueryOptions) {
    const mediaType = options?.mediaType ?? 'movie'
    return useQuery({
        queryKey: [ 'tmdb', 'top-rated', mediaType ],
        queryFn: async () => {
            const pages = await Promise.all(
                Array.from({ length: TOP_RATED_PAGE_COUNT }, (_, i) => getTopRatedTitles({ page: i + 1, mediaType })),
            )
            return pages.flatMap((page) => page.items)
        },
        enabled: options?.enabled,
    })
}

export function useSearchTitles(query: string, mediaType: MediaType = 'movie') {
    const trimmed = query.trim()

    return useInfiniteQuery({
        queryKey: [ 'tmdb', 'search', trimmed, mediaType ],
        queryFn: ({ pageParam }) => searchTitles(trimmed, mediaType, pageParam),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => (allPages.length < lastPage.totalPages ? allPages.length + 1 : undefined),
        enabled: trimmed.length > 1,
    })
}

// --- "Voir tout" pagination (infinite scroll) ---

export function usePopularTitlesInfinite(options?: QueryOptions) {
    const mediaType = options?.mediaType ?? 'movie'
    return useInfiniteQuery({
        queryKey: [ 'tmdb', 'popular', 'infinite', mediaType ],
        queryFn: ({ pageParam }) => getPopularTitles({ page: pageParam, mediaType }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => (allPages.length < lastPage.totalPages ? allPages.length + 1 : undefined),
        enabled: options?.enabled,
    })
}

export function useRecentTitlesInfinite(options?: QueryOptions) {
    const mediaType = options?.mediaType ?? 'movie'
    return useInfiniteQuery({
        queryKey: [ 'tmdb', 'recent', 'infinite', mediaType ],
        queryFn: ({ pageParam }) => getRecentTitles({ page: pageParam, mediaType }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => (allPages.length < lastPage.totalPages ? allPages.length + 1 : undefined),
        enabled: options?.enabled,
    })
}

export function useDiscoverTitlesInfinite(options?: QueryOptions) {
    const mediaType = options?.mediaType ?? 'movie'
    return useInfiniteQuery({
        queryKey: [ 'tmdb', 'discover', 'infinite', mediaType ],
        queryFn: ({ pageParam }) => getDiscoverTitles({ page: pageParam, mediaType }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => (allPages.length < lastPage.totalPages ? allPages.length + 1 : undefined),
        enabled: options?.enabled,
    })
}

// --- By genre ("un film drôle ce soir") ---

export function useGenres(mediaType: MediaType) {
    return useQuery({
        queryKey: [ 'tmdb', 'genres', mediaType ],
        // Fixed lookup table, practically never changes — no need to refetch every 5min.
        staleTime: 1000 * 60 * 60 * 24,
        queryFn: () => getGenres(mediaType),
    })
}

export function useTitlesByGenre(genreId: number, mediaType: MediaType, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: [ 'tmdb', 'genre', genreId, mediaType ],
        queryFn: async () => (await getTitlesByGenre({ genreId, mediaType })).items.slice(0, PREVIEW_LIMIT),
        enabled: options?.enabled,
    })
}

export function useTitlesByGenreInfinite(genreId: number, mediaType: MediaType, options?: { enabled?: boolean }) {
    return useInfiniteQuery({
        queryKey: [ 'tmdb', 'genre', 'infinite', genreId, mediaType ],
        queryFn: ({ pageParam }) => getTitlesByGenre({ genreId, page: pageParam, mediaType }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => (allPages.length < lastPage.totalPages ? allPages.length + 1 : undefined),
        enabled: options?.enabled,
    })
}

// --- Detail screen ---

export function useTitleDetails(tmdbId: number, mediaType: MediaType) {
    return useQuery({
        queryKey: [ 'tmdb', 'details', tmdbId, mediaType ],
        queryFn: () => getTitleDetails(tmdbId, mediaType),
        enabled: Number.isFinite(tmdbId) && tmdbId > 0,
    })
}

export function useSeasonDetails(tvId: number, seasonNumber: number) {
    return useQuery({
        queryKey: [ 'tmdb', 'season', tvId, seasonNumber ],
        queryFn: () => getSeasonDetails(tvId, seasonNumber),
        enabled: Number.isFinite(tvId) && tvId > 0 && Number.isFinite(seasonNumber),
    })
}
