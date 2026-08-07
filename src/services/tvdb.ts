import { supabase } from '@/lib/supabase'
import type { MediaType, TitleCastMember } from '@/types/tmdb'

// Top-billed only — TheTVDB can return a long characters list per title, most of them
// minor/background roles nobody would pick as a "favorite character". Same limit as the old
// TMDB-based cast list this replaces.
const MAIN_CAST_LIMIT = 12

async function tvdbRequest<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('tvdb', { body: { path, params } })
    if (error) throw new Error(`[tvdb] ${path} failed: ${error.message}`)
    return data as T
}

interface RawTvdbCharacter {
    peopleId: number;
    name: string;
    personName: string;
    image: string | null;
    personImgURL: string | null;
    peopleType: string;
    sort: number;
}

interface RawTvdbExtendedResponse {
    data: {
        characters?: RawTvdbCharacter[];
    };
}

interface RawTvdbRemoteIdMatch {
    movie?: { id: number };
    series?: { id: number };
}

interface RawTvdbRemoteIdResponse {
    data: RawTvdbRemoteIdMatch[];
}

// TMDB's external_ids only ever gives us `tvdb_id` for TV — movies never have it (verified
// live on several titles). `imdb_id` is present for both, and TheTVDB can resolve its own id
// from it via /search/remoteid/{imdbId}, so this is the fallback path for movies (and a safety
// net for the rare TV title TMDB doesn't cross-reference either).
async function resolveTvdbId(imdbId: string, mediaType: MediaType): Promise<number | null> {
    try {
        const response = await tvdbRequest<RawTvdbRemoteIdResponse>(`/search/remoteid/${imdbId}`)
        const match = response.data[ 0 ]
        return (mediaType === 'movie' ? match?.movie?.id : match?.series?.id) ?? null
    } catch {
        return null
    }
}

// Real character artwork only, never a repli on TheTVDB's own `personImgURL` (the actor's
// photo) — decided with the user: a title with no illustrated characters shows an empty
// picker rather than voice-cast photos, which defeats the whole point of using TheTVDB over
// TMDB here. `peopleType` filters out crew entries (directors, guests) that aren't characters
// at all; `sort` is TheTVDB's own billing order, same role as TMDB's `order`.
export async function getTvdbCharacters(
    mediaType: MediaType,
    ids: { tvdbId: number | null; imdbId: string | null },
): Promise<TitleCastMember[]> {
    try {
        const tvdbId = ids.tvdbId ?? (ids.imdbId ? await resolveTvdbId(ids.imdbId, mediaType) : null)
        if (tvdbId === null) return []

        const response = await tvdbRequest<RawTvdbExtendedResponse>(
            mediaType === 'movie' ? `/movies/${tvdbId}/extended` : `/series/${tvdbId}/extended`,
        )
        return (response.data.characters ?? [])
            .filter((character) => character.peopleType === 'Actor' && !!character.image)
            .sort((a, b) => a.sort - b.sort)
            .slice(0, MAIN_CAST_LIMIT)
            .map((character) => ({
                personId: character.peopleId,
                name: character.personName,
                character: character.name,
                profilePhotoUrl: character.image,
            }))
    } catch {
        // No tvdb_id match, title absent from TheTVDB, or a transient failure — never let this
        // break the detail page, just show no character picks for this title.
        return []
    }
}
