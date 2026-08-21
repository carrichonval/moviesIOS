import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Dimensions, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { ChevronLeft, Sparkles } from 'lucide-react-native'
import { SwipeMovieCard } from '@/features/movies/components/SwipeMovieCard'
import { useLibraryEntryLookup, useLibraryQuery, type MovieLibraryEntry } from '@/features/movies/api/library'
import { useGenres } from '@/features/movies/hooks/useTmdbBrowse'
import { getDiscoverTitles, getTitlesByGenres } from '@/services/tmdb'
import type { MediaType, TmdbBrowseItem } from '@/types/tmdb'

// Genre names, resolved once per deck item — the library already has names directly
// (MovieLibraryEntry.genres), TMDB-sourced items only carry ids (genreIds) and need the
// id->name lookup built from useGenres below. Threaded as its own field rather than bolted
// onto TmdbBrowseItem so the rest of the app (which never shows genres on a card) is
// unaffected.
interface DeckItem {
    item: TmdbBrowseItem;
    genres: string[];
}

// Smaller than edge-to-edge on purpose — leaving visible background margin around the card
// (plus its own border/shadow, see SwipeMovieCard) is what makes it read as a distinct
// card floating on the screen instead of just blending into it.
const CARD_WIDTH = Dimensions.get('window').width - 96
const CARD_ASPECT_RATIO = 3 / 2 // matches BrowseMovieCard/movie posters everywhere else
const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT_RATIO
// Peeking cards are genuinely smaller (not the top card scaled down via `transform`, which
// composes oddly with its own shadow/border at low opacity and looked like a smudge) —
// each one is narrower, positioned lower and centered. `top` is *derived*, not guessed: a
// smaller card is also shorter (same aspect ratio), so a small top offset alone doesn't
// necessarily push its bottom edge past the taller top card's bottom edge — the actual bug
// last time (offsets were smaller than the height lost to shrinking, so nothing peeked out
// at rest, only during the swipe animation's own motion). `top` here is set to exactly
// "shrunk height + a real visible sliver" so the peek is guaranteed, not incidental.
const PEEK_BOTTOM_VISIBLE = 20
const PEEK_1_WIDTH = CARD_WIDTH * 0.93
const PEEK_1_HEIGHT = PEEK_1_WIDTH * CARD_ASPECT_RATIO
const PEEK_1_TOP = CARD_HEIGHT - PEEK_1_HEIGHT + PEEK_BOTTOM_VISIBLE
const PEEK_2_WIDTH = CARD_WIDTH * 0.86
const PEEK_2_HEIGHT = PEEK_2_WIDTH * CARD_ASPECT_RATIO
// Same idea, one more visible increment further down than PEEK_1's own bottom edge.
const PEEK_2_TOP = CARD_HEIGHT + PEEK_BOTTOM_VISIBLE * 2 - PEEK_2_HEIGHT
const SWIPE_THRESHOLD = 120
const TAP_MOVEMENT_THRESHOLD = 8
const DISCOVER_PAGE_COUNT = 3
const DISCOVER_MAX_PAGE = 20

function shuffle<T>(items: T[]): T[] {
    const result = [ ...items ]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = result[ i ] as T
        result[ i ] = result[ j ] as T
        result[ j ] = tmp
    }
    return result
}

// Distinct random pages, not just a shuffled order of page 1 — otherwise every visit to
// the deck would show the same pool of titles every time (bug caught before implementing).
function randomPages(count: number, max: number): number[] {
    const pages = new Set<number>()
    while (pages.size < count) pages.add(1 + Math.floor(Math.random() * max))
    return [ ...pages ]
}

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

interface SwipeCardProps {
    item: TmdbBrowseItem;
    genres: string[];
    isTop: boolean;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onTap: () => void;
}

function SwipeCard({ item, genres, isTop, onSwipeLeft, onSwipeRight, onTap }: SwipeCardProps) {
    const translateX = useSharedValue(0)
    const translateY = useSharedValue(0)

    const panGesture = Gesture.Pan()
        .enabled(isTop)
        .onUpdate((e) => {
            translateX.value = e.translationX
            translateY.value = e.translationY * 0.3
        })
        .onEnd((e) => {
            const isTap = Math.abs(e.translationX) < TAP_MOVEMENT_THRESHOLD && Math.abs(e.translationY) < TAP_MOVEMENT_THRESHOLD

            if (isTap) {
                translateX.value = withSpring(0)
                translateY.value = withSpring(0)
                runOnJS(onTap)()
                return
            }

            if (e.translationX > SWIPE_THRESHOLD) {
                translateX.value = withTiming(CARD_WIDTH * 1.5, { duration: 250 }, (finished) => {
                    if (finished) runOnJS(onSwipeRight)()
                })
            } else if (e.translationX < -SWIPE_THRESHOLD) {
                translateX.value = withTiming(-CARD_WIDTH * 1.5, { duration: 250 }, (finished) => {
                    if (finished) runOnJS(onSwipeLeft)()
                })
            } else {
                translateX.value = withSpring(0)
                translateY.value = withSpring(0)
            }
        })

    const cardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${interpolate(translateX.value, [ -CARD_WIDTH, CARD_WIDTH ], [ -12, 12 ])}deg` },
        ],
    }))

    const likeStampStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [ 0, SWIPE_THRESHOLD ], [ 0, 1 ], 'clamp'),
    }))
    const nopeStampStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [ -SWIPE_THRESHOLD, 0 ], [ 1, 0 ], 'clamp'),
    }))

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View
                style={[ { position: 'absolute', width: CARD_WIDTH, height: CARD_HEIGHT }, cardStyle ]}
            >
                <SwipeMovieCard item={item} genres={genres} width={CARD_WIDTH} height={CARD_HEIGHT} />
                <Animated.View
                    style={[ { position: 'absolute', top: 24, left: 20 }, likeStampStyle ]}
                    className="-rotate-12 rounded-lg border-4 border-[#30D158] px-3 py-1"
                >
                    <Text className="text-[22px] font-extrabold text-[#30D158]">OUI</Text>
                </Animated.View>
                <Animated.View
                    style={[ { position: 'absolute', top: 24, right: 20 }, nopeStampStyle ]}
                    className="rotate-12 rounded-lg border-4 border-[#FF453A] px-3 py-1"
                >
                    <Text className="text-[22px] font-extrabold text-[#FF453A]">NON</Text>
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    )
}

export default function SwipeDeckScreen() {
    const params = useLocalSearchParams<{
        source: string;
        mediaType?: MediaType;
        genreIds?: string;
        genreName?: string;
    }>()
    const source: 'wishlist' | 'discover' = params.source === 'wishlist' ? 'wishlist' : 'discover'
    const mediaType: MediaType = params.mediaType === 'tv' ? 'tv' : 'movie'
    const genreIds = useMemo(
        () => (params.genreIds ? params.genreIds.split(',').map(Number) : []),
        [ params.genreIds ],
    )
    const title = source === 'wishlist' ? 'Liste de souhait' : (params.genreName || 'Découverte')

    const libraryQuery = useLibraryQuery()
    const libraryLookup = useLibraryEntryLookup()
    const { data: genreCatalog } = useGenres(mediaType)
    const genreNameById = useMemo(() => new Map((genreCatalog ?? []).map((g) => [ g.id, g.name ])), [ genreCatalog ])

    // Drawn once per screen visit, not on every render — see randomPages's comment.
    const [ discoverPages ] = useState(() => randomPages(DISCOVER_PAGE_COUNT, DISCOVER_MAX_PAGE))
    const discoverQuery = useQuery({
        queryKey: [ 'swipe-discover', mediaType, genreIds, discoverPages ],
        queryFn: async () => {
            const pages = await Promise.all(
                discoverPages.map((page) =>
                    genreIds.length > 0
                        ? getTitlesByGenres({ genreIds, page, mediaType })
                        : getDiscoverTitles({ page, mediaType }),
                ),
            )
            return pages.flatMap((p) => p.items)
        },
        enabled: source === 'discover',
    })

    const rawItems: DeckItem[] | undefined = useMemo(() => {
        if (source === 'wishlist') {
            if (!libraryQuery.data) return undefined
            return libraryQuery.data
                .filter((entry) => entry.isWishlist && entry.mediaType === mediaType)
                .map((entry) => ({ item: toBrowseItem(entry), genres: entry.genres }))
        }

        // Also wait on the genre catalog — the deck is only ever shuffled/built once (see
        // the effect below), so if it were built before names were ready, genre chips would
        // stay empty forever instead of just arriving a beat later.
        if (!discoverQuery.data || !genreCatalog) return undefined
        // A title can land on more than one random page — dedupe. Anything already in the
        // library isn't "discovery" anymore, so it's dropped too.
        const seenIds = new Set<number>()
        return discoverQuery.data
            .filter((item) => {
                if (seenIds.has(item.tmdbId)) return false
                seenIds.add(item.tmdbId)
                return !libraryLookup.has(`${item.mediaType}-${item.tmdbId}`)
            })
            .map((item) => ({
                item,
                genres: (item.genreIds ?? []).map((id) => genreNameById.get(id)).filter((n): n is string => !!n),
            }))
    }, [ source, mediaType, libraryQuery.data, discoverQuery.data, libraryLookup, genreNameById ])

    // Shuffled exactly once, when the data first arrives — reshuffling on every background
    // refetch mid-swipe would be jarring.
    const [ deck, setDeck ] = useState<DeckItem[] | null>(null)
    useEffect(() => {
        if (deck !== null || rawItems === undefined) return
        setDeck(shuffle(rawItems))
    }, [ rawItems, deck ])

    const [ index, setIndex ] = useState(0)

    function openDetail(item: TmdbBrowseItem) {
        router.push({ pathname: '/movie/[id]', params: { id: String(item.tmdbId), mediaType: item.mediaType } })
    }

    function handleSwipeLeft() {
        Haptics.selectionAsync()
        setIndex((i) => i + 1)
    }

    function handleSwipeRight() {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        const deckItem = deck?.[ index ]
        setIndex((i) => i + 1)
        if (deckItem) openDetail(deckItem.item)
    }

    function handleTap() {
        const deckItem = deck?.[ index ]
        setIndex((i) => i + 1)
        if (deckItem) openDetail(deckItem.item)
    }

    const isLoading = source === 'wishlist' ? libraryQuery.isLoading : discoverQuery.isLoading
    const isError = source === 'wishlist' ? libraryQuery.isError : discoverQuery.isError
    const current = deck?.[ index ]
    const next = deck?.[ index + 1 ]
    const nextNext = deck?.[ index + 2 ]

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <View className="mb-2 flex-row items-center gap-3 px-2.5">
                <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
                    <ChevronLeft size={26} color="#FFFFFF" />
                </Pressable>
                <Text className="flex-1 text-[20px] font-bold text-content-primary" numberOfLines={1}>
                    {title}
                </Text>
            </View>

            <View className="flex-1 items-center justify-center">
                {isLoading || deck === null ? (
                    <ActivityIndicator color="#409CFF" />
                ) : isError ? (
                    <Text className="px-10 text-center text-[15px] text-content-tertiary">
                        Impossible de charger les titres.
                    </Text>
                ) : deck.length === 0 ? (
                    <View className="items-center gap-3 px-10">
                        <Sparkles size={32} color="#EBEBF54D" />
                        <Text className="text-center text-[15px] text-content-tertiary">
                            {source === 'wishlist'
                                ? "Rien dans ta liste de souhait pour l'instant."
                                : 'Rien à te proposer pour l’instant.'}
                        </Text>
                    </View>
                ) : !current ? (
                    <View className="items-center gap-3 px-10">
                        <Sparkles size={32} color="#EBEBF54D" />
                        <Text className="text-center text-[15px] text-content-tertiary">
                            Plus rien à te proposer pour l'instant.
                        </Text>
                        <Pressable
                            onPress={() => router.replace('/swipe')}
                            className="rounded-full border border-border-subtle bg-surface px-4 py-2 active:opacity-60"
                        >
                            <Text className="text-[13px] font-medium text-content-secondary">Changer de source</Text>
                        </Pressable>
                    </View>
                ) : (
                    <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
                        {/* Two cards peeking behind the top one — just enough to read as
                            "there's more", not the full fanned stack from the reference
                            image. Furthest first so the nearer one draws on top. */}
                        {nextNext ? (
                            <View
                                style={{
                                    position: 'absolute',
                                    top: PEEK_2_TOP,
                                    left: (CARD_WIDTH - PEEK_2_WIDTH) / 2,
                                    opacity: 0.5,
                                }}
                            >
                                <SwipeMovieCard
                                    item={nextNext.item}
                                    genres={nextNext.genres}
                                    width={PEEK_2_WIDTH}
                                    height={PEEK_2_HEIGHT}
                                />
                            </View>
                        ) : null}
                        {next ? (
                            <View
                                style={{
                                    position: 'absolute',
                                    top: PEEK_1_TOP,
                                    left: (CARD_WIDTH - PEEK_1_WIDTH) / 2,
                                    opacity: 0.8,
                                }}
                            >
                                <SwipeMovieCard
                                    item={next.item}
                                    genres={next.genres}
                                    width={PEEK_1_WIDTH}
                                    height={PEEK_1_HEIGHT}
                                />
                            </View>
                        ) : null}
                        <SwipeCard
                            key={index}
                            item={current.item}
                            genres={current.genres}
                            isTop
                            onSwipeLeft={handleSwipeLeft}
                            onSwipeRight={handleSwipeRight}
                            onTap={handleTap}
                        />
                    </View>
                )}
            </View>
        </SafeAreaView>
    )
}
