import { supabase } from '@/lib/supabase'
import type {
    MediaType,
    TmdbBrowsePage,
    TmdbEpisodeSummary,
    TmdbPagedResponse,
    TmdbRawResult,
    TmdbSeasonDetails,
    TmdbSeasonSummary,
    TmdbTitleDetails,
    TmdbWatchProvider,
} from '@/types/tmdb'

const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/w342'
// Provider logos are small icons, not posters — w92 is TMDB's recommended size for them.
const TMDB_PROVIDER_LOGO_URL = 'https://image.tmdb.org/t/p/w92'

function tmdbPosterUrl(posterPath: string | null): string | null {
    return posterPath ? `${TMDB_IMAGE_URL}${posterPath}` : null
}

function tmdbProviderLogoUrl(logoPath: string | null): string | null {
    return logoPath ? `${TMDB_PROVIDER_LOGO_URL}${logoPath}` : null
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

interface RawSeason {
    season_number: number;
    name: string;
    poster_path: string | null;
    episode_count: number;
    air_date: string | null;
}

interface RawWatchProvider {
    provider_id: number;
    provider_name: string;
    logo_path: string | null;
}

interface RawVideo {
    key: string;
    site: string;
    type: string;
    official?: boolean;
}

interface RawTitleDetailsResponse extends TmdbRawResult {
    overview: string | null;
    genres: { id: number; name: string }[];
    similar?: TmdbPagedResponse;
    tagline?: string | null;
    /** Movies only. */
    runtime?: number | null;
    /** TV only — `seasons` is returned by the base /tv/{id} endpoint already, no
     * append_to_response needed. */
    number_of_seasons?: number | null;
    number_of_episodes?: number | null;
    seasons?: RawSeason[];
    // Key has a literal slash — TMDB's own field name, not a nested path. Keyed by country;
    // only France is used (this app has no region selector). `flatrate` = subscription only,
    // on purpose — rent/buy aren't fetched (decided with the user).
    'watch/providers'?: { results?: Record<string, { flatrate?: RawWatchProvider[] }> };
    videos?: { results?: RawVideo[] };
}

// Prefers the official YouTube trailer, falls back to any YouTube trailer, then to nothing
// (no fallback to a non-trailer video — a teaser/clip isn't what "bande-annonce" promises).
function pickTrailerUrl(videos: RawVideo[] | undefined): string | null {
    const youtubeTrailers = (videos ?? []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer')
    const trailer = youtubeTrailers.find((v) => v.official) ?? youtubeTrailers[ 0 ]
    return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null
}

function mapSeason(raw: RawSeason): TmdbSeasonSummary {
    return {
        seasonNumber: raw.season_number,
        name: raw.name,
        posterUrl: tmdbPosterUrl(raw.poster_path),
        episodeCount: raw.episode_count,
        airDate: raw.air_date,
    }
}

// `append_to_response: 'similar,watch/providers,videos'` bundles the recommendations row,
// streaming availability, and trailer into this same request — no extra round-trip for any
// of them. The detail endpoints already return tagline/runtime/seasons by default, on top
// of the fields the list endpoints share.
export async function getTitleDetails(tmdbId: number, mediaType: MediaType = 'movie'): Promise<TmdbTitleDetails> {
    const raw = await tmdbRequest<RawTitleDetailsResponse>(
        mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`,
        { append_to_response: 'similar,watch/providers,videos' },
    )

    const watchProviders: TmdbWatchProvider[] = (raw[ 'watch/providers' ]?.results?.FR?.flatrate ?? []).map((p) => ({
        providerId: p.provider_id,
        name: p.provider_name,
        logoUrl: tmdbProviderLogoUrl(p.logo_path),
    }))

    return {
        ...mapTmdbResult(raw, mediaType),
        overview: raw.overview || null,
        genres: raw.genres.map((genre) => genre.name),
        similar: (raw.similar?.results ?? []).map((item) => mapTmdbResult(item, mediaType)),
        tagline: raw.tagline || null,
        runtimeMinutes: mediaType === 'movie' ? (raw.runtime || null) : null,
        numberOfSeasons: mediaType === 'tv' ? (raw.number_of_seasons ?? null) : null,
        numberOfEpisodes: mediaType === 'tv' ? (raw.number_of_episodes ?? null) : null,
        seasons: (raw.seasons ?? []).map(mapSeason).sort((a, b) => a.seasonNumber - b.seasonNumber),
        watchProviders,
        trailerUrl: pickTrailerUrl(raw.videos?.results),
    }
}

interface RawEpisode {
    episode_number: number;
    name: string;
    still_path: string | null;
    air_date: string | null;
    overview: string | null;
}

interface RawSeasonDetailsResponse {
    season_number: number;
    name: string;
    poster_path: string | null;
    episodes: RawEpisode[];
}

function mapEpisode(raw: RawEpisode): TmdbEpisodeSummary {
    return {
        episodeNumber: raw.episode_number,
        name: raw.name,
        stillUrl: tmdbPosterUrl(raw.still_path),
        airDate: raw.air_date,
        overview: raw.overview || null,
    }
}

// One request per season (TMDB has no "all episodes of a show" endpoint) — fetched on
// demand when the user opens a season, not prefetched for every season on the show detail
// screen.
export async function getSeasonDetails(tvId: number, seasonNumber: number): Promise<TmdbSeasonDetails> {
    const raw = await tmdbRequest<RawSeasonDetailsResponse>(`/tv/${tvId}/season/${seasonNumber}`)
    return {
        seasonNumber: raw.season_number,
        name: raw.name,
        posterUrl: tmdbPosterUrl(raw.poster_path),
        episodes: (raw.episodes ?? []).map(mapEpisode).sort((a, b) => a.episodeNumber - b.episodeNumber),
    }
}

interface RawWatchProviderCatalogResponse {
    results?: RawWatchProvider[];
}

// The full catalog of subscription platforms available in France, independent of any one
// title — for the "favorite platforms" settings screen, not the detail page (which uses
// the per-title list bundled into getTitleDetails above). Movies' catalog is used for both
// media types: virtually every French streaming service that carries movies also carries
// shows, so a second /tv/... call here wouldn't add meaningfully different options.
export async function getWatchProviderCatalog(): Promise<TmdbWatchProvider[]> {
    const raw = await tmdbRequest<RawWatchProviderCatalogResponse>('/watch/providers/movie', { watch_region: 'FR' })
    return (raw.results ?? [])
        .map((p) => ({
            providerId: p.provider_id,
            name: p.provider_name,
            logoUrl: tmdbProviderLogoUrl(p.logo_path),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
}
