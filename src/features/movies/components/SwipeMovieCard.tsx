import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Star } from 'lucide-react-native'
import type { TmdbBrowseItem } from '@/types/tmdb'

interface SwipeMovieCardProps {
    item: TmdbBrowseItem;
    width: number;
    height: number;
    /** Already-resolved genre names — the deck screen resolves these (from the library
     * entry directly, or via useGenres for TMDB-sourced items) since results here are
     * mixed (several genres/sources at once), unlike a single-genre browse row. */
    genres?: string[];
}

function formatYear(releaseDate: string | null) {
    return releaseDate ? releaseDate.slice(0, 4) : null
}

// Full-bleed card for the swipe deck (src/app/(app)/swipe/[source].tsx) — deliberately not
// a scaled-up BrowseMovieCard: no ContextMenu (would fight the deck's own pan gesture), no
// memo (only ever 2 instances mounted at once, not 100+ in a grid), no library-state badges
// (this is about "does this look interesting", not "is this already in my library").
export function SwipeMovieCard({ item, width, height, genres = [] }: SwipeMovieCardProps) {
    const year = formatYear(item.releaseDate)

    return (
        // Shadow lives on this outer, non-clipping view — a shadow on the same view as
        // `overflow-hidden` (needed below, for the rounded corners + gradient) gets clipped
        // away on iOS, which was part of why the card blended into the black background.
        <View
            style={{
                width,
                height,
                borderRadius: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.45,
                shadowRadius: 16,
                elevation: 12,
            }}
        >
            <View className="overflow-hidden rounded-card border border-white/15 bg-surface" style={{ width, height }}>
                <Image
                    source={{ uri: item.posterUrl ?? undefined }}
                    style={{ width, height }}
                    contentFit="cover"
                    transition={200}
                />
                <LinearGradient
                    colors={[ 'transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)' ]}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                />
                <View className="absolute inset-x-0 bottom-0 gap-1.5 p-4">
                    <Text numberOfLines={2} className="text-[22px] font-bold text-white">
                        {item.title}
                    </Text>
                    {genres.length > 0 ? (
                        <View className="flex-row flex-wrap gap-1.5">
                            {genres.map((genre) => (
                                <View key={genre} className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5">
                                    <Text className="text-[11px] font-medium text-white/90">{genre}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                    <View className="flex-row items-center gap-3">
                        {year ? <Text className="text-[14px] text-white/80">{year}</Text> : null}
                        {item.rating ? (
                            <View className="flex-row items-center gap-1">
                                <Star size={14} color="#FFD60A" fill="#FFD60A" />
                                <Text className="text-[14px] font-medium text-white/90">{item.rating.toFixed(1)}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
        </View>
    )
}
