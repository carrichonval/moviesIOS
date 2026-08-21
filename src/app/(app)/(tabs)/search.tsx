import { useState } from 'react'
import { ActivityIndicator, Dimensions, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { ChevronRight, Search as SearchIcon, SearchX, Tags, X } from 'lucide-react-native'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { BrowseMovieCard } from '@/features/movies/components/BrowseMovieCard'
import { useLibraryEntryLookup, type MovieLibraryEntry } from '@/features/movies/api/library'
import {
    useDiscoverTitles,
    usePopularTitles,
    useRecentTitles,
    useSearchTitles,
    useTopRatedTitles,
} from '@/features/movies/hooks/useTmdbBrowse'
import type { MediaType, TmdbBrowseItem } from '@/types/tmdb'

const CATEGORY_TABS: { key: MediaType; label: string }[] = [
    { key: 'movie', label: 'Films' },
    { key: 'tv', label: 'Séries' },
]

const GRID_HORIZONTAL_PADDING = 10
const GRID_GAP = 15
const GRID_COLUMNS = 3

const ROW_CARD_WIDTH = 110

interface TitleRowProps {
    title: string;
    section: string;
    mediaType: MediaType;
    items: TmdbBrowseItem[] | undefined;
    isLoading: boolean;
    isError: boolean;
    delay: number;
    libraryLookup: Map<string, MovieLibraryEntry>;
}

function TitleRow({ title, section, mediaType, items, isLoading, isError, delay, libraryLookup }: TitleRowProps) {
    return (
        <Animated.View entering={FadeInDown.delay(delay).duration(400)} className="mb-8">
            <SectionHeader
                title={title}
                onPressSeeAll={() => router.push({ pathname: '/browse/[section]', params: { section, mediaType } })}
            />
            {isLoading ? (
                <View className="h-[165px] items-center justify-center">
                    <ActivityIndicator color="#409CFF" />
                </View>
            ) : isError || !items?.length ? (
                <View className="h-[165px] items-center justify-center px-2.5">
                    <Text className="text-center text-[13px] text-content-tertiary">
                        {isError ? "Impossible de charger cette liste." : "Rien à afficher."}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ overflow: 'visible' }}
                    contentContainerStyle={{ gap: 14, paddingHorizontal: 10 }}
                >
                    {items.map((item) => (
                        <BrowseMovieCard
                            key={`${item.mediaType}-${item.tmdbId}`}
                            item={item}
                            width={ROW_CARD_WIDTH}
                            libraryEntry={libraryLookup.get(`${item.mediaType}-${item.tmdbId}`) ?? null}
                        />
                    ))}
                </ScrollView>
            )}
        </Animated.View>
    )
}

export default function SearchScreen() {
    const insets = useSafeAreaInsets()
    const [ searchQuery, setSearchQuery ] = useState('')
    const [ isRefreshing, setIsRefreshing ] = useState(false)
    const [ mediaType, setMediaType ] = useState<MediaType>('movie')
    const libraryLookup = useLibraryEntryLookup()

    const trimmedQuery = searchQuery.trim()
    const isSearching = trimmedQuery.length > 1

    const gridCardWidth =
        (Dimensions.get('window').width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS

    const popular = usePopularTitles({ mediaType })
    const recent = useRecentTitles({ mediaType })
    const discover = useDiscoverTitles({ mediaType })
    const topRated = useTopRatedTitles({ mediaType })
    const search = useSearchTitles(trimmedQuery, mediaType)

    const searchResults = search.data?.pages.flatMap((page) => page.items) ?? []

    async function handleRefresh() {
        setIsRefreshing(true)
        await Promise.all([ popular.refetch(), recent.refetch(), discover.refetch(), topRated.refetch() ])
        setIsRefreshing(false)
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <Animated.View entering={FadeInDown.duration(300)} className="mb-6 px-2.5">
                <View className="flex-row items-center gap-2 rounded-2xl border border-border-subtle bg-surface px-3 py-2.5">
                    <SearchIcon size={18} color="#EBEBF599" />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Rechercher un film ou une série"
                        placeholderTextColor="#EBEBF599"
                        autoCorrect={false}
                        className="flex-1 text-[15px] text-content-primary"
                    />
                    {searchQuery.length > 0 ? (
                        <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                            <X size={18} color="#EBEBF599" />
                        </Pressable>
                    ) : null}
                </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(40).duration(300)} className="mb-6 flex-row gap-2 px-2.5">
                {CATEGORY_TABS.map((tab) => {
                    const isActive = mediaType === tab.key
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => setMediaType(tab.key)}
                            className={`flex-1 items-center rounded-full border px-3 py-2 active:opacity-60 ${
                                isActive ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                            }`}
                        >
                            <Text
                                className={`text-[13px] font-medium ${
                                    isActive ? 'text-accent-light' : 'text-content-secondary'
                                }`}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    )
                })}
            </Animated.View>

            {isSearching ? (
                search.isLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color="#409CFF" />
                    </View>
                ) : search.isError || !searchResults.length ? (
                    <View className="flex-1 items-center justify-center gap-3 px-10">
                        <SearchX size={32} color="#EBEBF54D" />
                        <Text className="text-center text-[15px] text-content-tertiary">
                            {search.isError
                                ? "Impossible de lancer la recherche."
                                : `Aucun résultat pour « ${trimmedQuery} »`}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        key={GRID_COLUMNS}
                        data={searchResults}
                        keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
                        numColumns={GRID_COLUMNS}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingHorizontal: GRID_HORIZONTAL_PADDING,
                            paddingBottom: insets.bottom + 24,
                            gap: GRID_GAP,
                        }}
                        columnWrapperStyle={{ gap: GRID_GAP }}
                        onEndReachedThreshold={0.4}
                        onEndReached={search.hasNextPage && !search.isFetchingNextPage ? () => search.fetchNextPage() : undefined}
                        renderItem={({ item }) => (
                            <BrowseMovieCard
                                item={item}
                                width={gridCardWidth}
                                libraryEntry={libraryLookup.get(`${item.mediaType}-${item.tmdbId}`) ?? null}
                            />
                        )}
                        ListFooterComponent={
                            search.isFetchingNextPage ? (
                                <View className="py-6">
                                    <ActivityIndicator color="#409CFF" />
                                </View>
                            ) : null
                        }
                    />
                )
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#409CFF" />
                    }
                >
                    <Animated.View entering={FadeInDown.delay(40).duration(400)} className="mb-6 px-2.5">
                        <Pressable
                            onPress={() => router.push('/genres')}
                            className="flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3.5 active:opacity-70"
                        >
                            <Tags size={20} color="#409CFF" />
                            <Text className="flex-1 text-[15px] font-semibold text-content-primary">
                                Explorer par catégorie
                            </Text>
                            <ChevronRight size={18} color="#8E8E93" />
                        </Pressable>
                    </Animated.View>

                    <TitleRow
                        title="Populaires"
                        section="popular"
                        mediaType={mediaType}
                        items={popular.data}
                        isLoading={popular.isLoading}
                        isError={popular.isError}
                        delay={80}
                        libraryLookup={libraryLookup}
                    />
                    <TitleRow
                        title="Récents"
                        section="recent"
                        mediaType={mediaType}
                        items={recent.data}
                        isLoading={recent.isLoading}
                        isError={recent.isError}
                        delay={140}
                        libraryLookup={libraryLookup}
                    />
                    <TitleRow
                        title="Découverte"
                        section="discover"
                        mediaType={mediaType}
                        items={discover.data}
                        isLoading={discover.isLoading}
                        isError={discover.isError}
                        delay={200}
                        libraryLookup={libraryLookup}
                    />
                    <TitleRow
                        title="Top 100"
                        section="top-rated"
                        mediaType={mediaType}
                        items={topRated.data?.slice(0, 10)}
                        isLoading={topRated.isLoading}
                        isError={topRated.isError}
                        delay={260}
                        libraryLookup={libraryLookup}
                    />
                </ScrollView>
            )}
        </SafeAreaView>
    )
}
