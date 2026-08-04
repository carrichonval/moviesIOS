import { QueryClient } from '@tanstack/react-query';

// gcTime must be >= the persister's maxAge (see queryPersister.ts) — otherwise a query
// gets garbage-collected from memory before it's ever written to disk.
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: PERSIST_MAX_AGE,
      retry: 2,
    },
  },
});
