import { supabase } from '@/lib/supabase'
import type { MediaType, TmdbBrowsePage, TmdbPagedResponse, TmdbRawResult } from '@/types/tmdb'

const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/w342'

function tmdbPosterUrl(posterPath: string | null): string | null {
    return posterPath ? `${TMDB_IMAGE_URL}${posterPath}` : null
}

function mapTmdbResult(raw: TmdbRawResult, mediaType: MediaType) {
    return {
        tmdbId: raw.id,
        mediaType,
        title: raw.title ?? raw.name ?? '',
        posterUrl: tmdbPosterUrl(raw.poster_path),
        releaseDate: raw.release_date ?? raw.first_air_date ?? null,
        rating: raw.vote_average ? Math.round(raw.vote_average * 10) / 10 : null,
        voteCount: raw.vote_count ?? null,
    }
}

// Routed through the `tmdb` edge function so the read access token stays server-side
// (client-embedded env vars ship inside the app bundle).
async function tmdbRequest<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('tmdb', { body: { path, params } })
    if (error) throw new Error(`[tmdb] ${path} failed: ${error.message}`)
    return data as T
}

async function fetchPage(
    path: string,
    mediaType: MediaType,
    params?: Record<string, string | number>,
): Promise<TmdbBrowsePage> {
    const result = await tmdbRequest<TmdbPagedResponse>(path, params)
    return { items: result.results.map((raw) => mapTmdbResult(raw, mediaType)), totalPages: result.total_pages }
}

interface PageParams {
    page?: number;
    mediaType?: MediaType;
}

export async function getPopularTitles({ page = 1, mediaType = 'movie' }: PageParams = {}): Promise<TmdbBrowsePage> {
    return fetchPage(mediaType === 'movie' ? '/movie/popular' : '/tv/popular', mediaType, { page })
}

// "Récent" — currently in theaters for movies, currently airing for TV (TMDB has no single
// endpoint that covers both media types the same way).
export async function getRecentTitles({ page = 1, mediaType = 'movie' }: PageParams = {}): Promise<TmdbBrowsePage> {
    return fetchPage(mediaType === 'movie' ? '/movie/now_playing' : '/tv/on_the_air', mediaType, { page })
}

// "Découverte": well-rated titles that haven't racked up a huge vote count yet — same
// hidden-gems idea as gameTracker's discover row.
export async function getDiscoverTitles({ page = 1, mediaType = 'movie' }: PageParams = {}): Promise<TmdbBrowsePage> {
    return fetchPage(mediaType === 'movie' ? '/discover/movie' : '/discover/tv', mediaType, {
        page,
        sort_by: 'vote_average.desc',
        'vote_average.gte': 7,
        'vote_count.gte': 50,
        'vote_count.lte': 300,
    })
}

export async function getTopRatedTitles({ page = 1, mediaType = 'movie' }: PageParams = {}): Promise<TmdbBrowsePage> {
    return fetchPage(mediaType === 'movie' ? '/movie/top_rated' : '/tv/top_rated', mediaType, { page })
}

export async function searchTitles(query: string, mediaType: MediaType = 'movie', page = 1): Promise<TmdbBrowsePage> {
    const trimmed = query.trim()
    if (!trimmed) return { items: [], totalPages: 0 }

    return fetchPage(mediaType === 'movie' ? '/search/movie' : '/search/tv', mediaType, { query: trimmed, page })
}

export interface TmdbGenre {
    id: number;
    name: string;
}

// TMDB's genre list is a fixed, virtually-never-changing lookup table (not paginated) —
// separate movie/tv sets since a genre id doesn't mean the same thing across media types.
export async function getGenres(mediaType: MediaType = 'movie'): Promise<TmdbGenre[]> {
    const { genres } = await tmdbRequest<{ genres: TmdbGenre[] }>(
        mediaType === 'movie' ? '/genre/movie/list' : '/genre/tv/list',
    )
    return genres
}

interface GenrePageParams extends PageParams {
    genreId: number;
}

export async function getTitlesByGenre({ genreId, page = 1, mediaType = 'movie' }: GenrePageParams): Promise<TmdbBrowsePage> {
    return fetchPage(mediaType === 'movie' ? '/discover/movie' : '/discover/tv', mediaType, {
        page,
        with_genres: genreId,
        sort_by: 'popularity.desc',
    })
}
