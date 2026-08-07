import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TitleCastMember } from '@/types/tmdb'

// The `movies` schema isn't in src/types/database.ts — see the same cast in
// src/features/movies/api/library.ts.
const moviesDb = (supabase as any).schema('movies')

export interface FavoriteCharacter {
    userId: string;
    characterPersonId: number;
    characterName: string;
    actorName: string;
    profilePhotoUrl: string | null;
}

interface FavoriteCharacterRow {
    user_id: string;
    character_person_id: number;
    character_name: string;
    actor_name: string;
    profile_photo_url: string | null;
}

async function fetchFavoriteCharacters(libraryEntryId: string): Promise<FavoriteCharacter[]> {
    const { data, error } = await moviesDb
        .from('favorite_characters')
        .select('user_id, character_person_id, character_name, actor_name, profile_photo_url')
        .eq('library_entry_id', libraryEntryId)

    if (error) throw error
    return (data as FavoriteCharacterRow[]).map((row) => ({
        userId: row.user_id,
        characterPersonId: row.character_person_id,
        characterName: row.character_name,
        actorName: row.actor_name,
        profilePhotoUrl: row.profile_photo_url,
    }))
}

// Only ever 0-2 rows for a title (one per person) — fetched on demand, not folded into
// fetchLibrary(), same precedent as useSeasonWatchesQuery/useShowWatchesQuery: nowhere
// outside the detail page needs this.
export function useFavoriteCharactersQuery(libraryEntryId: string | null) {
    return useQuery({
        queryKey: [ 'favorite-characters', libraryEntryId ],
        queryFn: () => fetchFavoriteCharacters(libraryEntryId as string),
        enabled: libraryEntryId !== null,
    })
}

// Personal, like ratings — upserts on (library_entry_id, user_id) so picking a new
// character just replaces the previous pick instead of stacking rows. Denormalizes the
// chosen cast member's name/character/photo (see 0014_favorite_characters.sql) so
// re-displaying a saved pick never needs a fresh credits fetch.
export function useSetFavoriteCharacter() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            libraryEntryId,
            userId,
            character,
        }: {
            libraryEntryId: string;
            userId: string;
            character: TitleCastMember;
        }) => {
            const { error } = await moviesDb.from('favorite_characters').upsert(
                {
                    library_entry_id: libraryEntryId,
                    user_id: userId,
                    character_person_id: character.personId,
                    character_name: character.character,
                    actor_name: character.name,
                    profile_photo_url: character.profilePhotoUrl,
                },
                { onConflict: 'library_entry_id,user_id' },
            )
            if (error) throw error
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: [ 'favorite-characters', variables.libraryEntryId ] })
        },
    })
}
