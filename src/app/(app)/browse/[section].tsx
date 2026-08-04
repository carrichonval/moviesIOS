import { ActivityIndicator, Dimensions, FlatList, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { BrowseMovieCard } from '@/features/movies/components/BrowseMovieCard'
import {
    useDiscoverTitlesInfinite,
    usePopularTitlesInfinite,
    useRecentTitlesInfinite,
    useTitlesByGenreInfinite,
    useTopRatedTitles,
} from '@/features/movies/hooks/useTmdbBrowse'
import type { MediaType, TmdbBrowseItem } from '@/types/tmdb'

const GRID_HORIZONTAL_PADDING = 16
const GRID_GAP = 12
const GRID_COLUMNS = 3

const SECTION_TITLES: Record<string, string> = {
    popular: 'Populaires',
    recent: 'Récents',
    discover: 'Découverte',
    'top-rated': 'Top 100',
}

export default function BrowseSectionScreen() {
    const { section, mediaType, genreId, genreName } = useLocalSearchParams<{
        section: string;
        mediaType?: MediaType;
        genreId?: string;
        genreName?: string;
    }>()
    const resolvedMediaType: MediaType = mediaType === 'tv' ? 'tv' : 'movie'
    const resolvedGenreId = Number(genreId ?? 0)

    const popular = usePopularTitlesInfinite({ enabled: section === 'popular', mediaType: resolvedMediaType })
    const recent = useRecentTitlesInfinite({ enabled: section === 'recent', mediaType: resolvedMediaType })
    const discover = useDiscoverTitlesInfinite({ enabled: section === 'discover', mediaType: resolvedMediaType })
    const topRated = useTopRatedTitles({ enabled: section === 'top-rated', mediaType: resolvedMediaType })
    const genre = useTitlesByGenreInfinite(resolvedGenreId, resolvedMediaType, {
        enabled: section === 'genre' && resolvedGenreId > 0,
    })

    const title = section === 'genre' ? (genreName ?? 'Catégorie') : SECTION_TITLES[ section ?? '' ] ?? (resolvedMediaType === 'tv' ? 'Séries' : 'Films')

    const cardWidth =
        (Dimensions.get('window').width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS

    let items: TmdbBrowseItem[] = []
    let isLoading = false
    let isError = false
    let isFetchingMore = false
    let onEndReached: (() => void) | undefined

    if (section === 'popular' || section === 'recent' || section === 'discover' || section === 'genre') {
        const query = section === 'popular' ? popular : section === 'recent' ? recent : section === 'discover' ? discover : genre
        items = query.data?.pages.flatMap((page) => page.items) ?? []
        isLoading = query.isLoading
        isError = query.isError
        isFetchingMore = query.isFetchingNextPage
        onEndReached = query.hasNextPage && !query.isFetchingNextPage ? () => query.fetchNextPage() : undefined
    } else if (section === 'top-rated') {
        items = topRated.data ?? []
        isLoading = topRated.isLoading
        isError = topRated.isError
    }

    // Pagination can hand back a title already seen on an earlier page if the underlying
    // TMDB ordering shifts between fetches (e.g. vote count changing rank) — dedupe so no key
    // collides.
    const seenIds = new Set<number>()
    items = items.filter((item) => {
        if (seenIds.has(item.tmdbId)) return false
        seenIds.add(item.tmdbId)
        return true
    })

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <View className="mb-4 flex-row items-center gap-3 px-5">
                <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
                    <ChevronLeft size={26} color="#FFFFFF" />
                </Pressable>
                <Text className="flex-1 text-[20px] font-bold text-content-primary">{title}</Text>
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#409CFF" />
                </View>
            ) : isError ? (
                <View className="flex-1 items-center justify-center px-10">
                    <Text className="text-center text-[15px] text-content-tertiary">
                        Impossible de charger cette liste.
                    </Text>
                </View>
            ) : (
                <FlatList
                    key={GRID_COLUMNS}
                    data={items}
                    keyExtractor={(item) => String(item.tmdbId)}
                    numColumns={GRID_COLUMNS}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingHorizontal: GRID_HORIZONTAL_PADDING,
                        paddingBottom: 24,
                        gap: GRID_GAP,
                    }}
                    columnWrapperStyle={{ gap: GRID_GAP }}
                    onEndReachedThreshold={0.4}
                    onEndReached={onEndReached}
                    renderItem={({ item }) => <BrowseMovieCard item={item} width={cardWidth} />}
                    ListFooterComponent={
                        isFetchingMore ? (
                            <View className="py-6">
                                <ActivityIndicator color="#409CFF" />
                            </View>
                        ) : null
                    }
                />
            )}
        </SafeAreaView>
    )
}
