import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn } from 'react-native-reanimated'
import ContextMenu, {
    type ContextMenuAction,
    type ContextMenuOnPressNativeEvent,
} from 'react-native-context-menu-view'
import { Check, Heart, Star } from 'lucide-react-native'
import type { TmdbBrowseItem } from '@/types/tmdb'
import { useLibraryQuery, useMarkAsViewed, useToggleWishlist } from '@/features/movies/api/library'

interface BrowseMovieCardProps {
    item: TmdbBrowseItem;
    width?: number;
}

const COVER_RADIUS = 16
const COVER_WIDTH = 110
const COVER_ASPECT_RATIO = 3 / 2 // TMDB posters are 2:3 (width:height)

const WISHLIST_LABEL = 'Liste de souhait'

// Not tappable (short press) yet — search/browse is display-only until the detail screen
// exists. Long-press already wires into the shared movie library though.
export function BrowseMovieCard({ item, width = COVER_WIDTH }: BrowseMovieCardProps) {
    const libraryQuery = useLibraryQuery()
    const toggleWishlist = useToggleWishlist()
    const markAsViewed = useMarkAsViewed()

    const libraryEntry = libraryQuery.data?.find(
        (entry) => entry.tmdbId === item.tmdbId && entry.mediaType === item.mediaType,
    )
    const isWishlist = libraryEntry?.isWishlist ?? false
    const hasViewed = (libraryEntry?.viewingsCount ?? 0) > 0
    const viewedLabel = hasViewed ? 'Revu' : 'Vu'

    const contextMenuActions: ContextMenuAction[] = useMemo(
        () => [
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
        ],
        [ isWishlist, hasViewed, viewedLabel ],
    )

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
        }
    }

    const imageSource = useMemo(() => ({ uri: item.posterUrl ?? undefined }), [ item.posterUrl ])
    const height = width * COVER_ASPECT_RATIO

    // Quick visual read of the shared library state without opening the long-press menu —
    // green check once it's been watched at least once, red heart while it's on the
    // wishlist (both can show at once: "seen, but we still want to rewatch it").
    const badges = (
        <>
            {hasViewed ? (
                <View className="h-6 w-6 items-center justify-center rounded-full bg-black/50">
                    <Check size={13} color="#30D158" />
                </View>
            ) : null}
            {isWishlist ? (
                <View className="h-6 w-6 items-center justify-center rounded-full bg-black/50">
                    <Heart size={12} color="#FF453A" fill="#FF453A" />
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
                <Pressable onLongPress={() => {}} delayLongPress={400} style={StyleSheet.absoluteFillObject}>
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
                    </View>
                </Pressable>
            </ContextMenu>
        </Animated.View>
    )
}
