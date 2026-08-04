import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn } from 'react-native-reanimated'
import ContextMenu, {
    type ContextMenuAction,
    type ContextMenuOnPressNativeEvent,
} from 'react-native-context-menu-view'
import { router } from 'expo-router'
import { Check, Heart, Star } from 'lucide-react-native'
import type { TmdbBrowseItem } from '@/types/tmdb'
import { useAuth } from '@/features/auth/AuthProvider'
import { useLibraryQuery, useMarkAsViewed, useRateTitle, useToggleWishlist } from '@/features/movies/api/library'

interface BrowseMovieCardProps {
    item: TmdbBrowseItem;
    width?: number;
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
}

const COVER_RADIUS = 16
const COVER_WIDTH = 110
const COVER_ASPECT_RATIO = 3 / 2 // TMDB posters are 2:3 (width:height)

const WISHLIST_LABEL = 'Liste de souhait'
export const RATING_VALUES = [ 1, 2, 3, 4, 5 ]

// "Mine" (blue) vs "the other person's" (pink) rather than fixed names — works for
// whichever of the two accounts is signed in, and for the second household account
// once it exists (see 0001_movies_schema.sql — rating is the one per-user field here).
const MY_RATING_COLOR = '#409CFF'
const PARTNER_RATING_COLOR = '#FF2D55'

export function BrowseMovieCard({
    item,
    width = COVER_WIDTH,
    allowRating = false,
    showViewedBadge = true,
    showWishlistBadge = true,
}: BrowseMovieCardProps) {
    const { session } = useAuth()
    const libraryQuery = useLibraryQuery()
    const toggleWishlist = useToggleWishlist()
    const markAsViewed = useMarkAsViewed()
    const rateTitle = useRateTitle()

    const libraryEntry = libraryQuery.data?.find(
        (entry) => entry.tmdbId === item.tmdbId && entry.mediaType === item.mediaType,
    )
    const isWishlist = libraryEntry?.isWishlist ?? false
    const hasViewed = (libraryEntry?.viewingsCount ?? 0) > 0
    const viewedLabel = hasViewed ? 'Revu' : 'Vu'

    const myRating = libraryEntry?.ratings.find((r) => r.userId === session?.user.id)?.rating ?? null
    const partnerRating = libraryEntry?.ratings.find((r) => r.userId !== session?.user.id)?.rating ?? null

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
            {
                title: viewedLabel,
                systemIcon: 'checkmark.circle',
                selected: hasViewed,
            },
        ]

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

        return actions
    }, [ isWishlist, hasViewed, viewedLabel, canRate, myRating ])

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

        if (name === 'Vu' || name === 'Revu') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            markAsViewed.mutate(item, {
                onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
                onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
            })
            return
        }

        const ratingMatch = RATING_VALUES.find((value) => `${value} ★` === name)
        if (ratingMatch !== undefined) {
            Haptics.selectionAsync()
            rateTitle.mutate(
                { item, rating: ratingMatch },
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
    // wishlist (both can show at once: "seen, but we still want to rewatch it").
    const badges = (
        <>
            {hasViewed && showViewedBadge ? (
                <View className="h-6 w-6 items-center justify-center rounded-full bg-black/50">
                    <Check size={13} color="#30D158" />
                </View>
            ) : null}
            {isWishlist && showWishlistBadge ? (
                <View className="h-6 w-6 items-center justify-center rounded-full bg-black/50">
                    <Heart size={12} color="#FF453A" fill="#FF453A" />
                </View>
            ) : null}
        </>
    )

    const ratingBadges = (
        <>
            {myRating ? (
                <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: MY_RATING_COLOR }}>
                    <Text className="text-[11px] font-bold text-white">{myRating}</Text>
                </View>
            ) : null}
            {partnerRating ? (
                <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: PARTNER_RATING_COLOR }}>
                    <Text className="text-[11px] font-bold text-white">{partnerRating}</Text>
                </View>
            ) : null}
        </>
    )

    return (
        <Animated.View entering={FadeIn.duration(300)} style={{ width }}>
            <View className="overflow-hidden rounded-card bg-surface" style={{ borderRadius: COVER_RADIUS }}>
                <Image
                    source={imageSource}
                    recyclingKey={`${item.mediaType}-${item.tmdbId}`}
                    style={{ width, height }}
                    contentFit="cover"
                    transition={200}
                />
                <View className="absolute right-2 top-2 flex-row items-center gap-1">{badges}</View>
                {item.rating ? (
                    <View className="absolute bottom-2 left-2 flex-row items-center gap-1 rounded-full bg-black/60 px-2 py-1">
                        <Star size={11} color="#FFD60A" fill="#FFD60A" />
                        <Text className="text-[11px] font-semibold text-content-primary">{item.rating.toFixed(1)}</Text>
                    </View>
                ) : null}
                <View className="absolute bottom-2 right-2 flex-row items-center gap-1">{ratingBadges}</View>
            </View>
            {/* ContextMenu sits as a transparent touch layer above the image instead of
                wrapping it — a second render of the same image, same idea as
                BrowseGameCard/GameCoverCard in gameTracker, so the long-press preview
                doesn't share a native view with the persistent layer and desync/flicker. */}
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
                            style={{ width, height }}
                            contentFit="cover"
                            transition={200}
                        />
                        <View className="absolute right-2 top-2 flex-row items-center gap-1">{badges}</View>
                        {item.rating ? (
                            <View className="absolute bottom-2 left-2 flex-row items-center gap-1 rounded-full bg-black/60 px-2 py-1">
                                <Star size={11} color="#FFD60A" fill="#FFD60A" />
                                <Text className="text-[11px] font-semibold text-content-primary">
                                    {item.rating.toFixed(1)}
                                </Text>
                            </View>
                        ) : null}
                        <View className="absolute bottom-2 right-2 flex-row items-center gap-1">{ratingBadges}</View>
                    </View>
                </Pressable>
            </ContextMenu>
        </Animated.View>
    )
}
