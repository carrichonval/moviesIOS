export type MediaType = 'movie' | 'tv'

export interface TmdbRawResult {
    id: number;
    title?: string;
    name?: string;
    poster_path: string | null;
    release_date?: string;
    first_air_date?: string;
    vote_average: number;
    vote_count: number;
    /** TMDB includes this on essentially every result-list endpoint (search, popular,
     * discover, similar...) — genre *names* require a separate id->name lookup
     * (see useGenres), so only the raw ids are captured here. */
    genre_ids?: number[];
}

export interface TmdbPagedResponse {
    page: number;
    results: TmdbRawResult[];
    total_pages: number;
    total_results: number;
}

export interface TmdbBrowseItem {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    posterUrl: string | null;
    releaseDate: string | null;
    rating: number | null;
    voteCount: number | null;
    /** Optional — most cards don't display genres, only the swipe deck currently resolves
     * these (via useGenres) into names to show on the card. */
    genreIds?: number[];
}

export interface TmdbBrowsePage {
    items: TmdbBrowseItem[];
    totalPages: number;
}

/** TV only — a season's own summary, not its episode list (that's a later, separate fetch). */
export interface TmdbSeasonSummary {
    seasonNumber: number;
    name: string;
    posterUrl: string | null;
    episodeCount: number;
    airDate: string | null;
}

export interface TmdbEpisodeSummary {
    episodeNumber: number;
    name: string;
    stillUrl: string | null;
    airDate: string | null;
    overview: string | null;
}

/** The season's own episode list — separate fetch from `TmdbSeasonSummary`, one per season. */
export interface TmdbSeasonDetails {
    seasonNumber: number;
    name: string;
    posterUrl: string | null;
    episodes: TmdbEpisodeSummary[];
}

/** A single streaming platform — subscription ("flatrate") only, rent/buy aren't fetched. */
export interface TmdbWatchProvider {
    providerId: number;
    name: string;
    logoUrl: string | null;
}

export interface TmdbTitleDetails {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    posterUrl: string | null;
    releaseDate: string | null;
    rating: number | null;
    voteCount: number | null;
    overview: string | null;
    genres: string[];
    similar: TmdbBrowseItem[];
    tagline: string | null;
    /** Movies only. */
    runtimeMinutes: number | null;
    /** TV only. */
    numberOfSeasons: number | null;
    numberOfEpisodes: number | null;
    seasons: TmdbSeasonSummary[];
    /** Subscription platforms available in France — see TmdbWatchProvider. */
    watchProviders: TmdbWatchProvider[];
    /** YouTube trailer link, if TMDB has one — null is common and fine, no fallback needed. */
    trailerUrl: string | null;
}
