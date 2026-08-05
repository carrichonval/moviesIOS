import { useMemo, useState } from 'react'
import { Dimensions, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { Search, SearchX, X } from 'lucide-react-native'
import { Skeleton } from '@/components/ui/Skeleton'
import { BrowseMovieCard } from '@/features/movies/components/BrowseMovieCard'
import { useLibraryQuery, type MovieLibraryEntry } from '@/features/movies/api/library'
import type { MediaType, TmdbBrowseItem } from '@/types/tmdb'

// Matches gameTracker's own library grid (`(tabs)/index.tsx`) exactly.
const GRID_HORIZONTAL_PADDING = 10
const GRID_GAP = 15
const GRID_COLUMNS = 3

type WatchedTab = 'vu' | 'en-cours' | 'a-voir'

// Only TV shows ever land here (a movie has no partial-progress state — see `isInProgress`
// in api/library.ts), so this tab is empty until a series has some, but not all, of its
// episodes checked.
function matchesWatchedTab(entry: MovieLibraryEntry, tab: WatchedTab): boolean {
    if (tab === 'vu') return entry.isWatched
    if (tab === 'en-cours') return entry.isInProgress
    return entry.isWishlist
}
type MediaFilter = 'tous' | MediaType

const MEDIA_FILTERS: { key: MediaFilter; label: string }[] = [
    { key: 'tous', label: 'Tous' },
    { key: 'movie', label: 'Films' },
    { key: 'tv', label: 'Séries' },
]

function toBrowseItem(entry: MovieLibraryEntry): TmdbBrowseItem {
    return {
        tmdbId: entry.tmdbId,
        mediaType: entry.mediaType,
        title: entry.name,
        posterUrl: entry.posterUrl,
        releaseDate: entry.releaseDate,
        rating: null,
        voteCount: null,
    }
}

function LibraryGridSkeleton({ cardWidth }: { cardWidth: number }) {
    // Must match the real FlatList's `contentContainerStyle` padding exactly (see below) —
    // `cardWidth` is computed against `GRID_HORIZONTAL_PADDING`, so a different padding
    // here (this used to be a hardcoded `px-4`, i.e. 16px vs. the real 10px) leaves less
    // room than the cards were sized for, dropping the 3rd column to the next row. That's
    // what read as "the grid flickers from 2 columns to 3" on a slow first load — the
    // skeleton and the real grid were laid out with two different padding values.
    return (
        <View className="flex-row flex-wrap" style={{ gap: GRID_GAP, paddingHorizontal: GRID_HORIZONTAL_PADDING }}>
            {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton key={index} width={cardWidth} height={cardWidth * 1.5} rounded={16} />
            ))}
        </View>
    )
}

export default function LibraryScreen() {
    const tabBarHeight = useBottomTabBarHeight()
    const libraryQuery = useLibraryQuery()
    const library = libraryQuery.data ?? []

    const [ searchQuery, setSearchQuery ] = useState('')
    const [ watchedTab, setWatchedTab ] = useState<WatchedTab>('vu')
    const [ mediaFilter, setMediaFilter ] = useState<MediaFilter>('tous')
    const [ isRefreshing, setIsRefreshing ] = useState(false)

    async function handleRefresh() {
        setIsRefreshing(true)
        await libraryQuery.refetch()
        setIsRefreshing(false)
    }

    // "Vu" = watched (movies: at least one viewing; TV: every episode checked). "En cours"
    // = a series with some episodes checked but not all — never a movie. "À voir" = on the
    // wishlist, independent of watched state (e.g. "envie de le revoir"). These three can
    // overlap (a title with none of them appears in none of the tabs) — see
    // `matchesWatchedTab` / `isWatched` / `isInProgress` in api/library.ts.
    const vuCount = useMemo(() => library.filter((entry) => entry.isWatched).length, [ library ])
    const enCoursCount = useMemo(() => library.filter((entry) => entry.isInProgress).length, [ library ])
    const aVoirCount = useMemo(() => library.filter((entry) => entry.isWishlist).length, [ library ])

    const mediaCounts = useMemo(() => {
        const entries = library.filter((entry) => matchesWatchedTab(entry, watchedTab))
        return {
            tous: entries.length,
            movie: entries.filter((entry) => entry.mediaType === 'movie').length,
            tv: entries.filter((entry) => entry.mediaType === 'tv').length,
        }
    }, [ library, watchedTab ])

    const watchedTabEntries = useMemo(
        () => library.filter((entry) => matchesWatchedTab(entry, watchedTab)),
        [ library, watchedTab ],
    )
    const mediaFilteredEntries = useMemo(
        () =>
            mediaFilter === 'tous'
                ? watchedTabEntries
                : watchedTabEntries.filter((entry) => entry.mediaType === mediaFilter),
        [ watchedTabEntries, mediaFilter ],
    )

    const normalizedQuery = searchQuery.trim().toLowerCase()
    const visibleEntries = useMemo(
        () =>
            normalizedQuery
                ? mediaFilteredEntries.filter((entry) => entry.name.toLowerCase().includes(normalizedQuery))
                : mediaFilteredEntries,
        [ mediaFilteredEntries, normalizedQuery ],
    )

    // "Vu"/"En cours" sort by when it was (last) watched/progressed, not when it was added —
    // a title added ages ago but watched yesterday should still show up near the top.
    // "À voir" has no viewing to sort by, so it falls back to most-recently-added, matching
    // the old web app.
    const sortedEntries = useMemo(() => {
        const sorted = [ ...visibleEntries ]
        if (watchedTab === 'vu' || watchedTab === 'en-cours') {
            sorted.sort((a, b) => (b.lastViewedAt ?? '').localeCompare(a.lastViewedAt ?? ''))
        } else {
            sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
        }
        return sorted
    }, [ visibleEntries, watchedTab ])

    const cardWidth =
        (Dimensions.get('window').width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS

    function getEmptyMessage() {
        if (normalizedQuery) return `Aucun résultat pour « ${searchQuery.trim()} »`
        if (watchedTab === 'vu') return "Rien de vu pour l'instant"
        if (watchedTab === 'en-cours') return 'Aucune série en cours'
        return "Rien à voir pour l'instant"
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <View className="mb-4 px-5 pt-3">
                <View className="flex-row items-center gap-2 rounded-2xl border border-border-subtle bg-surface px-3 py-2.5">
                    <Search size={18} color="#EBEBF599" />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Rechercher dans ta bibliothèque"
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
            </View>

            <View className="mb-3 flex-row gap-2 px-5">
                <Pressable
                    onPress={() => setWatchedTab('vu')}
                    className={`flex-1 items-center rounded-2xl border py-2.5 active:opacity-60 ${
                        watchedTab === 'vu' ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                    }`}
                >
                    <Text className={`text-[14px] font-semibold ${watchedTab === 'vu' ? 'text-accent-light' : 'text-content-secondary'}`}>
                        Vu ({vuCount})
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => {
                        setWatchedTab('en-cours')
                        // Only series ever show up here, so a media filter left over from
                        // another tab (e.g. "Films") would just filter everything out —
                        // reset it rather than leave a confusing empty list.
                        setMediaFilter('tous')
                    }}
                    className={`flex-1 items-center rounded-2xl border py-2.5 active:opacity-60 ${
                        watchedTab === 'en-cours' ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                    }`}
                >
                    <Text
                        className={`text-[14px] font-semibold ${
                            watchedTab === 'en-cours' ? 'text-accent-light' : 'text-content-secondary'
                        }`}
                    >
                        En cours ({enCoursCount})
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setWatchedTab('a-voir')}
                    className={`flex-1 items-center rounded-2xl border py-2.5 active:opacity-60 ${
                        watchedTab === 'a-voir' ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                    }`}
                >
                    <Text className={`text-[14px] font-semibold ${watchedTab === 'a-voir' ? 'text-accent-light' : 'text-content-secondary'}`}>
                        À voir ({aVoirCount})
                    </Text>
                </Pressable>
            </View>

            {watchedTab !== 'en-cours' ? (
                <View className="mb-4 flex-row gap-2 px-5">
                    {MEDIA_FILTERS.map((filter) => {
                        const isActive = mediaFilter === filter.key
                        return (
                            <Pressable
                                key={filter.key}
                                onPress={() => setMediaFilter(filter.key)}
                                className={`flex-row items-center gap-1 rounded-full border px-3 py-1.5 active:opacity-60 ${
                                    isActive ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                                }`}
                            >
                                <Text className={`text-[13px] font-medium ${isActive ? 'text-accent-light' : 'text-content-secondary'}`}>
                                    {filter.label} ({mediaCounts[ filter.key ]})
                                </Text>
                            </Pressable>
                        )
                    })}
                </View>
            ) : null}

            {libraryQuery.isLoading ? (
                <LibraryGridSkeleton cardWidth={cardWidth} />
            ) : libraryQuery.isError ? (
                <View className="flex-1 items-center justify-center px-10">
                    <Text className="text-center text-[15px] text-content-tertiary">
                        Impossible de charger ta bibliothèque.
                    </Text>
                </View>
            ) : sortedEntries.length === 0 ? (
                <View className="flex-1 items-center justify-center gap-3 px-10">
                    <SearchX size={32} color="#EBEBF54D" />
                    <Text className="text-center text-[15px] text-content-tertiary">{getEmptyMessage()}</Text>
                </View>
            ) : (
                // Stable key, same as gameTracker's own library grid (`entry.userGameId`) — a
                // card that's in both the old and new filter (e.g. "Films" is a 90%-overlapping
                // subset of "Tous") keeps its identity and never remounts, only the cards that
                // actually leave/enter the filtered set do.
                <FlatList
                    key={GRID_COLUMNS}
                    data={sortedEntries}
                    keyExtractor={(entry) => entry.libraryEntryId}
                    numColumns={GRID_COLUMNS}
                    // Defaults (windowSize=21) pre-render ~21 screens' worth around the current
                    // position — on a 100+ item filter that's most/all of the list at once on
                    // every tap, even though only ~12-15 cards are ever actually visible. These
                    // caps make a tap only render what's on screen (+ a small buffer); the rest
                    // streams in as the user scrolls, same as any virtualized list.
                    initialNumToRender={2}
                    maxToRenderPerBatch={6}
                    windowSize={5}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#409CFF" />}
                    contentContainerStyle={{
                        paddingHorizontal: GRID_HORIZONTAL_PADDING,
                        paddingBottom: tabBarHeight + 24,
                        gap: GRID_GAP,
                    }}
                    columnWrapperStyle={{ gap: GRID_GAP }}
                    renderItem={({ item: entry }) => (
                        <BrowseMovieCard
                            item={toBrowseItem(entry)}
                            libraryEntry={entry}
                            width={cardWidth}
                            allowRating
                            showViewedBadge={false}
                            showWishlistBadge={watchedTab !== 'a-voir'}
                            showInProgressBadge={watchedTab !== 'en-cours'}
                            showRatingBadges
                        />
                    )}
                />
            )}
        </SafeAreaView>
    )
}
