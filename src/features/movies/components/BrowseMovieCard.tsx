import { memo, useMemo } from 'react'
import { Alert, Pressable, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn } from 'react-native-reanimated'
import ContextMenu, {
    type ContextMenuAction,
    type ContextMenuOnPressNativeEvent,
} from 'react-native-context-menu-view'
import { router } from 'expo-router'
import { Check, Heart, ListChecks } from 'lucide-react-native'
import type { TmdbBrowseItem } from '@/types/tmdb'
import { MAEVA_RATING_COLOR, MAEVA_USER_ID, VALENTIN_RATING_COLOR, VALENTIN_USER_ID } from '@/constants/people'
import { useAuth } from '@/features/auth/AuthProvider'
import {
    useMarkAsViewed,
    useRateTitle,
    useRemoveFromLibrary,
    useToggleWishlist,
    type MovieLibraryEntry,
} from '@/features/movies/api/library'

interface BrowseMovieCardProps {
    item: TmdbBrowseItem;
    width?: number;
    /** Resolved library state for this exact item, or `null` if it isn't in the library at
     * all. Required, not optional: the card itself has zero data-fetching hooks (no
     * `useLibraryQuery()` inside), so at 150+ simultaneous cards there's no per-card
     * QueryObserver overhead — every caller resolves this once, up front, the same way
     * gameTracker's `GameCoverCard` receives fully-resolved props. Screens that only have a
     * bare `TmdbBrowseItem[]` (search/browse/similar rows) call `useLibraryEntryLookup()`
     * once and look each item up by `${mediaType}-${tmdbId}`; the library screen already has
     * the resolved entry per row and passes it straight through. */
    libraryEntry: MovieLibraryEntry | null;
    /** Offer "Noter" in the long-press menu — off by default. Even when on, it only shows
     * once the title has actually been watched (rating something you've never seen makes
     * no sense), so search/browse cards never pass this and library cards still won't show
     * it for wishlist-only, not-yet-watched entries. */
    allowRating?: boolean;
    /** Show the "already watched" checkmark badge — on by default (it's the whole point in
     * search/browse: spot what you've already seen). Off on the library screen, where every
     * card is already in the library and the badge would just be noise. */
    showViewedBadge?: boolean;
    /** Show the wishlist heart badge — on by default. Off on the library screen's "À voir"
     * tab, where every card is already wishlisted by definition (still on by default in
     * "Vu", where it means something: seen, but still wants a rewatch). */
    showWishlistBadge?: boolean;
    /** Show the "some episodes watched" badge (TV only) — on by default. Off on the library
     * screen's "En cours" tab, where every card there already means that by definition. */
    showInProgressBadge?: boolean;
    /** Show each person's rating (heart + number, bottom corners) — off by default. Only the
     * library screen turns this on; search/browse/genres/similar-titles rows are about
     * discovering something new, not reviewing what's already been rated. */
    showRatingBadges?: boolean;
}

const COVER_RADIUS = 16
const COVER_WIDTH = 110
const COVER_ASPECT_RATIO = 3 / 2 // TMDB posters are 2:3 (width:height)

const WISHLIST_LABEL = 'Liste de souhait'
const REMOVE_LABEL = 'Retirer de la bibliothèque'
export const RATING_VALUES = [ 1, 2, 3, 4, 5 ]

function BrowseMovieCardComponent({
    item,
    width = COVER_WIDTH,
    libraryEntry: libraryEntryProp,
    allowRating = false,
    showViewedBadge = true,
    showWishlistBadge = true,
    showInProgressBadge = true,
    showRatingBadges = false,
}: BrowseMovieCardProps) {
    const { session } = useAuth()
    const libraryEntry = libraryEntryProp
    const toggleWishlist = useToggleWishlist()
    const markAsViewed = useMarkAsViewed()
    const rateTitle = useRateTitle()
    const removeFromLibrary = useRemoveFromLibrary()

    const isWishlist = libraryEntry?.isWishlist ?? false
    // Movies: at least one viewing. TV: every episode checked (`isWatched` in
    // api/library.ts) — tracked per-episode on the season screen, not from this card.
    const hasViewed = libraryEntry?.isWatched ?? false
    // TV shows don't get this action at all — "watched" is derived from episode progress,
    // there's nothing sensible for a card long-press to increment. Not `selected: hasViewed`
    // for movies — this action always inserts another viewing (see `useMarkAsViewed`), it
    // never un-marks anything, so showing it as an already-checked toggle item was misleading.
    const canMarkViewed = item.mediaType === 'movie'
    const viewedLabel = hasViewed ? 'Revu (+1)' : 'Marquer comme vu'

    const myRating = libraryEntry?.ratings.find((r) => r.userId === session?.user.id)?.rating ?? null
    // Fixed by identity, not "mine vs the other account" — same as the detail screen, so a
    // title shows the same two colors regardless of whose phone you're looking at.
    const valentinRating = libraryEntry?.ratings.find((r) => r.userId === VALENTIN_USER_ID)?.rating ?? null
    const maevaRating = libraryEntry?.ratings.find((r) => r.userId === MAEVA_USER_ID)?.rating ?? null

    // Rating a title you've never watched doesn't make sense, so the option only shows
    // once there's at least one viewing — and only where the caller opted in at all
    // (allowRating), which search/browse cards never do (see prop doc above).
    const canRate = allowRating && hasViewed

    const contextMenuActions: ContextMenuAction[] = useMemo(() => {
        const actions: ContextMenuAction[] = [
            {
                title: WISHLIST_LABEL,
                systemIcon: isWishlist ? 'heart.fill' : 'heart',
                selected: isWishlist,
            },
        ]

        if (canMarkViewed) {
            actions.push({
                title: viewedLabel,
                systemIcon: hasViewed ? 'arrow.clockwise' : 'checkmark.circle',
            })
        }

        if (canRate) {
            actions.push({
                title: myRating ? `Ma note : ${myRating}` : 'Noter',
                systemIcon: myRating ? 'star.fill' : 'star',
                actions: RATING_VALUES.map((value) => ({
                    title: `${value} ★`,
                    systemIcon: value === myRating ? 'star.fill' : 'star',
                    selected: value === myRating,
                })),
            })
        }

        // Only offered once the title is actually in the library — nothing to remove
        // otherwise. There was previously no way to undo a mistaken add (wrong duplicate,
        // wrong version of a show) short of editing the database by hand.
        if (libraryEntry) {
            actions.push({
                title: REMOVE_LABEL,
                systemIcon: 'trash',
                destructive: true,
            })
        }

        return actions
    }, [ isWishlist, hasViewed, viewedLabel, canMarkViewed, canRate, myRating, libraryEntry ])

    function handleContextMenuPress(e: NativeSyntheticEvent<ContextMenuOnPressNativeEvent>) {
        const { name } = e.nativeEvent

        if (name === WISHLIST_LABEL) {
            Haptics.selectionAsync()
            toggleWishlist.mutate(
                { item, isWishlist: !isWishlist },
                { onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
            )
            return
        }

        if (name === viewedLabel) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            markAsViewed.mutate(item, {
                onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
                onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
            })
            return
        }

        if (name === REMOVE_LABEL) {
            if (!libraryEntry) return
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            Alert.alert(
                'Retirer de la bibliothèque ?',
                `« ${item.title} » sera retiré, avec son historique (vu, notes, épisodes cochés). Cette action est irréversible.`,
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Retirer',
                        style: 'destructive',
                        onPress: () => {
                            removeFromLibrary.mutate(libraryEntry.libraryEntryId, {
                                onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
                                onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
                            })
                        },
                    },
                ],
            )
            return
        }

        const ratingMatch = RATING_VALUES.find((value) => `${value} ★` === name)
        if (ratingMatch !== undefined) {
            Haptics.selectionAsync()
            rateTitle.mutate(
                { item, rating: ratingMatch, userId: session?.user.id },
                {
                    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
                    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
                },
            )
        }
    }

    function handlePress() {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        router.push({ pathname: '/movie/[id]', params: { id: String(item.tmdbId), mediaType: item.mediaType } })
    }

    const imageSource = useMemo(() => ({ uri: item.posterUrl ?? undefined }), [ item.posterUrl ])
    const height = width * COVER_ASPECT_RATIO

    // Quick visual read of the shared library state without opening the long-press menu —
    // green check once it's been watched at least once, red heart while it's on the
    // wishlist (both can show at once: "seen, but we still want to rewatch it"), orange
    // list-checks while a series has some (not all) episodes checked.
    const badges = (
        <>
            {hasViewed && showViewedBadge ? (
                <View className="h-6 w-6 items-center justify-center rounded-full bg-black/50">
                    <Check size={13} color="#30D158" />
                </View>
            ) : null}
            {(libraryEntry?.isInProgress ?? false) && showInProgressBadge ? (
                <View className="h-6 w-6 items-center justify-center rounded-full bg-black/50">
                    <ListChecks size={12} color="#FF9F0A" />
                </View>
            ) : null}
            {isWishlist && showWishlistBadge ? (
                <View className="h-6 w-6 items-center justify-center rounded-full bg-black/50">
                    <Heart size={12} color="#FF453A" fill="#FF453A" />
                </View>
            ) : null}
        </>
    )

    // Each person's note on this title, as a small heart + number — same shape as the
    // partner-rating badge on the detail screen (`movie/[id].tsx`), one on each bottom
    // corner instead of side by side, visible without opening the long-press menu.
    const valentinRatingBadge = showRatingBadges && valentinRating ? (
        <View className="flex-row items-center gap-1 rounded-full bg-black/60 px-1.5 py-1">
            <Heart size={12} color={VALENTIN_RATING_COLOR} fill={VALENTIN_RATING_COLOR} />
            <Text className="text-[11px] font-semibold text-content-primary">{valentinRating}</Text>
        </View>
    ) : null

    const maevaRatingBadge = showRatingBadges && maevaRating ? (
        <View className="flex-row items-center gap-1 rounded-full bg-black/60 px-1.5 py-1">
            <Heart size={12} color={MAEVA_RATING_COLOR} fill={MAEVA_RATING_COLOR} />
            <Text className="text-[11px] font-semibold text-content-primary">{maevaRating}</Text>
        </View>
    ) : null

    return (
        <Animated.View entering={FadeIn.duration(300)} style={{ width }}>
            {/* Bare image, no badges — this bottom copy exists only as a static fallback the
                long-press animation below can never desync (see the comment on
                `ContextMenu`), so it's never seen for more than a couple of frames. Badges
                (viewed/wishlist/ratings) only render on the copy that's actually visible
                below — duplicating them here was real per-card mount cost for a layer
                nobody looks at, back when 100+ cards rendered simultaneously; the FlatList
                windowing in `(tabs)/index.tsx` now caps that to ~12-30 at a time. */}
            <View className="overflow-hidden rounded-card bg-surface" style={{ borderRadius: COVER_RADIUS }}>
                <Image
                    source={imageSource}
                    recyclingKey={`${item.mediaType}-${item.tmdbId}`}
                    style={{ width, height }}
                    contentFit="cover"
                    transition={200}
                />
            </View>
            {/* ContextMenu sits as a transparent touch layer above the image instead of
                wrapping it — a second render of the same image, same idea as
                BrowseGameCard/GameCoverCard in gameTracker, so the long-press preview
                doesn't share a native view with the persistent layer and desync/flicker.
                This second copy is the one normally visible (it paints on top) — see the
                comment above for why badges only render here. */}
            <ContextMenu
                actions={contextMenuActions}
                onPress={handleContextMenuPress}
                previewBackgroundColor="transparent"
                borderRadius={COVER_RADIUS}
                style={StyleSheet.absoluteFillObject}
            >
                <Pressable onPress={handlePress} onLongPress={() => {}} delayLongPress={400} style={StyleSheet.absoluteFillObject}>
                    <View className="overflow-hidden rounded-card bg-surface">
                        <Image
                            source={{ uri: item.posterUrl ?? undefined }}
                            recyclingKey={`${item.mediaType}-${item.tmdbId}`}
                            style={{ width, height }}
                            contentFit="cover"
                            transition={200}
                        />
                        <View className="absolute right-2 top-2 flex-row items-center gap-1">{badges}</View>
                        <View className="absolute bottom-2 left-2">{valentinRatingBadge}</View>
                        <View className="absolute bottom-2 right-2">{maevaRatingBadge}</View>
                    </View>
                </Pressable>
            </ContextMenu>
        </Animated.View>
    )
}

// `item` is rebuilt as a fresh object on every render wherever a parent maps a list into
// `TmdbBrowseItem`/`MovieLibraryEntry` shapes (every current call site does) — reference
// equality would never match, defeating memoization entirely. Compare the fields that
// actually affect what's drawn instead, so switching an unrelated filter/tab on a 200+
// item library grid doesn't re-render (and re-run each card's own library lookup for)
// every visible card, only the ones whose own data actually changed.
function arePropsEqual(prev: BrowseMovieCardProps, next: BrowseMovieCardProps) {
    return (
        prev.item.tmdbId === next.item.tmdbId &&
        prev.item.mediaType === next.item.mediaType &&
        prev.item.title === next.item.title &&
        prev.item.posterUrl === next.item.posterUrl &&
        prev.item.releaseDate === next.item.releaseDate &&
        prev.item.rating === next.item.rating &&
        prev.item.voteCount === next.item.voteCount &&
        prev.width === next.width &&
        prev.allowRating === next.allowRating &&
        prev.showViewedBadge === next.showViewedBadge &&
        prev.showWishlistBadge === next.showWishlistBadge &&
        prev.showInProgressBadge === next.showInProgressBadge &&
        prev.libraryEntry?.isWishlist === next.libraryEntry?.isWishlist &&
        prev.libraryEntry?.isWatched === next.libraryEntry?.isWatched &&
        prev.libraryEntry?.isInProgress === next.libraryEntry?.isInProgress &&
        ratingsKey(prev.libraryEntry) === ratingsKey(next.libraryEntry)
    )
}

function ratingsKey(entry: MovieLibraryEntry | null | undefined) {
    if (!entry) return ''
    return entry.ratings.map((r) => `${r.userId}:${r.rating}`).sort().join(',')
}

export const BrowseMovieCard = memo(BrowseMovieCardComponent, arePropsEqual)
