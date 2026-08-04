import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getActivityGroupLabel } from '@/utils/date'
import type { MediaType } from '@/types/tmdb'

// Plenty for a shared library's full history — this isn't a paginated feed.
const MAX_EVENTS = 500

const moviesDb = (supabase as any).schema('movies')

type MovieEventType = 'wishlisted' | 'viewed'

interface EventRow {
    id: string;
    event_type: MovieEventType;
    occurred_at: string;
    library_entries: {
        id: string;
        titles: { tmdb_id: number; media_type: MediaType; name: string; poster_url: string | null };
    };
}

export interface MovieActivityEvent {
    id: string;
    type: MovieEventType;
    /** Only meaningful for `type: 'viewed'` — false for the first viewing of a title, true after. */
    isRewatch: boolean;
    occurredAt: string;
    title: { tmdbId: number; mediaType: MediaType; name: string; posterUrl: string | null };
}

export interface TimelineSection {
    key: string;
    label: string;
    events: MovieActivityEvent[];
}

async function fetchTimeline(): Promise<MovieActivityEvent[]> {
    const { data, error } = await moviesDb
        .from('events')
        .select('id, event_type, occurred_at, library_entries(id, titles(tmdb_id, media_type, name, poster_url))')
        .order('occurred_at', { ascending: false })
        .limit(MAX_EVENTS)

    if (error) throw error
    const rows = data as EventRow[]

    // First 'viewed' event per library_entry (chronologically) reads as "Vu", every one
    // after that as "Revu" — rows arrive newest-first, so walk them in reverse to find it.
    const firstViewedEventId = new Map<string, string>()
    for (const row of [ ...rows ].reverse()) {
        if (row.event_type !== 'viewed') continue
        if (!firstViewedEventId.has(row.library_entries.id)) {
            firstViewedEventId.set(row.library_entries.id, row.id)
        }
    }

    return rows.map((row) => ({
        id: row.id,
        type: row.event_type,
        isRewatch: row.event_type === 'viewed' && firstViewedEventId.get(row.library_entries.id) !== row.id,
        occurredAt: row.occurred_at,
        title: {
            tmdbId: row.library_entries.titles.tmdb_id,
            mediaType: row.library_entries.titles.media_type,
            name: row.library_entries.titles.name,
            posterUrl: row.library_entries.titles.poster_url,
        },
    }))
}

// Sections are built with a single forward pass that merges an event into the previous
// section when its group key matches — correct whether there's 1 event or 500, no
// minimum-count assumption anywhere in here.
function groupEvents(events: MovieActivityEvent[]): TimelineSection[] {
    const now = new Date()
    const sections: TimelineSection[] = []

    for (const event of events) {
        const { key, label } = getActivityGroupLabel(event.occurredAt, now)
        const currentSection = sections[ sections.length - 1 ]
        if (currentSection?.key === key) {
            currentSection.events.push(event)
        } else {
            sections.push({ key, label, events: [ event ] })
        }
    }

    return sections
}

export function useMovieTimeline() {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: [ 'movie-timeline' ],
        queryFn: fetchTimeline,
    })

    const sections = data ? groupEvents(data) : []

    return { sections, isEmpty: (data?.length ?? 0) === 0, isLoading, isError, refetch }
}
