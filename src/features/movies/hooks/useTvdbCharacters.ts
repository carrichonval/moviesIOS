import { useQuery } from '@tanstack/react-query'
import { getTvdbCharacters } from '@/services/tvdb'
import type { MediaType } from '@/types/tmdb'

// Separate from useTmdbBrowse.ts (TMDB-only) — TheTVDB is a distinct data source, only used
// for character artwork on the detail screen's "Personnage préféré" section. Needs both ids:
// `tvdbId` (TV only, straight from TMDB) and `imdbId` (movies' fallback, resolved against
// TheTVDB's own id inside getTvdbCharacters) — see src/services/tvdb.ts.
export function useTvdbCharacters(mediaType: MediaType, tvdbId: number | null, imdbId: string | null) {
    return useQuery({
        queryKey: [ 'tvdb', 'characters', mediaType, tvdbId, imdbId ],
        queryFn: () => getTvdbCharacters(mediaType, { tvdbId, imdbId }),
        enabled: tvdbId !== null || imdbId !== null,
    })
}
