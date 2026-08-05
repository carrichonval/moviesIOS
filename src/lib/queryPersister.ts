import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'

// Bump this whenever a cached query's shape changes incompatibly — mismatches the buster
// stamped in old persisted caches, so they're discarded instead of being fed to code that
// no longer expects them.
// Bumped: 'episode-watches' used to cache a `Set` (episode numbers), which serializes to
// `{}` through this same AsyncStorage persister and rehydrates with no `.has()` — surfaced
// as "watchedEpisodes.has is not a function" on relaunch even though the underlying data
// was fine. Now caches a plain array instead (see fetchEpisodeWatches in api/library.ts);
// this bump discards any already-corrupted `{}` sitting in a device's persisted cache.
const CACHE_BUSTER = '8'

const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7 // 7 days, matches queryClient.ts's gcTime

const persister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'app-query-cache',
})

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
    persister,
    maxAge: PERSIST_MAX_AGE,
    buster: CACHE_BUSTER,
}
