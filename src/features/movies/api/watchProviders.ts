import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TmdbWatchProvider } from '@/types/tmdb'

// The `movies` schema isn't in src/types/database.ts — see the same cast in
// src/features/movies/api/library.ts.
const moviesDb = (supabase as any).schema('movies')

const FAVORITE_PROVIDERS_QUERY_KEY = [ 'favorite-watch-providers' ]

interface FavoriteProviderRow {
    provider_id: number;
    provider_name: string;
    logo_path: string | null;
}

// Plain array, never a `Set` — this goes through the AsyncStorage-persisted query cache,
// which round-trips through JSON. A `Set` has no enumerable own properties, so it
// serializes to `{}` and rehydrates with no `.has()` — exactly the
// "watchedEpisodes.has is not a function" bug hit earlier for episode-watches. Consumers
// build their own `Set` at render time instead (see useFavoriteProviderIds below).
async function fetchFavoriteProviders(): Promise<FavoriteProviderRow[]> {
    const { data, error } = await moviesDb.from('favorite_watch_providers').select('provider_id, provider_name, logo_path')
    if (error) throw error
    return data as FavoriteProviderRow[]
}

export function useFavoriteProvidersQuery() {
    return useQuery({
        queryKey: FAVORITE_PROVIDERS_QUERY_KEY,
        queryFn: fetchFavoriteProviders,
    })
}

/** O(1) membership check for the detail page's yellow-border logic. */
export function useFavoriteProviderIds() {
    const query = useFavoriteProvidersQuery()
    return useMemo(() => new Set(query.data?.map((row) => row.provider_id) ?? []), [ query.data ])
}

// Shared, like the rest of this schema (0013_favorite_watch_providers.sql) — either
// person toggling a platform changes it for both, no user_id.
export function useToggleFavoriteProvider() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ provider, isFavorite }: { provider: TmdbWatchProvider; isFavorite: boolean }) => {
            if (isFavorite) {
                const { error } = await moviesDb.from('favorite_watch_providers').upsert(
                    { provider_id: provider.providerId, provider_name: provider.name, logo_path: provider.logoUrl },
                    { onConflict: 'provider_id' },
                )
                if (error) throw error
                return
            }

            const { error } = await moviesDb.from('favorite_watch_providers').delete().eq('provider_id', provider.providerId)
            if (error) throw error
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: FAVORITE_PROVIDERS_QUERY_KEY }),
    })
}
