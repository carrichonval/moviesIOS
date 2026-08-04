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
}

export interface TmdbBrowsePage {
    items: TmdbBrowseItem[];
    totalPages: number;
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
}
