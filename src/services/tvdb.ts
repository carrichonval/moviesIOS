import { supabase } from '@/lib/supabase'
import type { MediaType, TitleCastMember } from '@/types/tmdb'

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

function toTitleCastMember(character: RawTvdbCharacter, photoUrl: string | null): TitleCastMember {
    return {
        personId: character.peopleId,
        name: character.personName,
        character: character.name,
        profilePhotoUrl: photoUrl,
    }
}

// `peopleType` filters out crew entries (directors, guests) that aren't characters at all. No
// top-N cap — the user wants every character available, not just the leads; `sort` (TheTVDB's
// own billing order) just orders them, doesn't trim the list.
//
// Illustrated character art (`image`) is preferred whenever a title has any — verified live on
// a sample of the real library: animated/heavily-fan-followed titles (Digital Circus,
// Spider-Verse, Saw) are richly illustrated, but most live-action movies have none at all
// (TheTVDB's character art is community-contributed and sparse there). For a title with zero
// illustrated characters, repli on `personImgURL` (the actor's own photo, also from TheTVDB) —
// decided with the user: an empty picker for most of the library was worse than showing actor
// photos on titles that will never get illustrated art. This is all-or-nothing per title, never
// a per-character mix of art and photos within the same list.
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
        const actors = (response.data.characters ?? [])
            .filter((character) => character.peopleType === 'Actor')
            .sort((a, b) => a.sort - b.sort)

        const illustrated = actors.filter((character) => !!character.image)
        if (illustrated.length > 0) {
            return illustrated.map((character) => toTitleCastMember(character, character.image))
        }
        return actors
            .filter((character) => !!character.personImgURL)
            .map((character) => toTitleCastMember(character, character.personImgURL))
    } catch {
        // No tvdb_id match, title absent from TheTVDB, or a transient failure — never let this
        // break the detail page, just show no character picks for this title.
        return []
    }
}
