import { Eye, Heart, ListChecks, RotateCcw, type LucideIcon } from 'lucide-react-native'
import type { MovieActivityEvent } from '@/features/movies/hooks/useMovieTimeline'

interface EventDisplay {
    /** Action text shown before the title name, e.g. "A ajouté à la liste de souhait". */
    label: string;
    icon: LucideIcon;
    color: string;
}

export function getMovieEventDisplay(event: MovieActivityEvent): EventDisplay {
    if (event.type === 'wishlisted') {
        return { label: 'Ajouté à la liste de souhait', icon: Heart, color: '#8E8E93' }
    }

    if (event.type === 'episode_watched') {
        return {
            label: `S${event.seasonNumber}E${event.episodeNumber} vu`,
            icon: ListChecks,
            color: '#FF9F0A',
        }
    }

    return event.isRewatch
        ? { label: 'Revu', icon: RotateCcw, color: '#30D158' }
        : { label: 'Vu', icon: Eye, color: '#409CFF' }
}
