import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'

// Bump this whenever a cached query's shape changes incompatibly — mismatches the buster
// stamped in old persisted caches, so they're discarded instead of being fed to code that
// no longer expects them.
// Bumped: MovieLibraryEntry gained isInProgress. Bump this on every field addition to a
// cached query's result shape — this has already bitten four times for "small" fields.
const CACHE_BUSTER = '6'

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
