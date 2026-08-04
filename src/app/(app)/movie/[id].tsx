import { useMemo } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Check, ChevronLeft, Heart, Star } from 'lucide-react-native'
import { Skeleton } from '@/components/ui/Skeleton'
import { BrowseMovieCard, RATING_VALUES } from '@/features/movies/components/BrowseMovieCard'
import { MAEVA_RATING_COLOR, MAEVA_USER_ID, VALENTIN_RATING_COLOR, VALENTIN_USER_ID } from '@/constants/people'
import { useAuth } from '@/features/auth/AuthProvider'
import { useLibraryEntryLookup, useMarkAsViewed, useRateTitle, useToggleWishlist } from '@/features/movies/api/library'
import { useTitleDetails } from '@/features/movies/hooks/useTmdbBrowse'
import type { MediaType } from '@/types/tmdb'

const COVER_WIDTH = 148
const COVER_ASPECT_RATIO = 3 / 2 // TMDB posters are 2:3 (width:height)
const SIMILAR_CARD_WIDTH = 110
const SEASON_CARD_WIDTH = 110

function formatReleaseDate(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatRuntime(minutes: number | null) {
    if (!minutes) return null
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return hours > 0 ? `${hours}h${String(remainingMinutes).padStart(2, '0')}` : `${remainingMinutes}min`
}

function formatSeasons(seasons: number | null, episodes: number | null) {
    if (!seasons) return null
    const seasonsLabel = `${seasons} saison${seasons > 1 ? 's' : ''}`
    return episodes ? `${seasonsLabel} · ${episodes} épisodes` : seasonsLabel
}

function Chip({ label }: { label: string }) {
    return (
        <View className="rounded-full border border-accent-light/40 bg-accent-light/10 px-2.5 py-1">
            <Text className="text-[11px] font-medium text-accent-light">{label}</Text>
        </View>
    )
}

function DetailSkeleton() {
    return (
        <View className="flex-row items-start gap-4 px-5">
            <Skeleton width={COVER_WIDTH} height={COVER_WIDTH * COVER_ASPECT_RATIO} rounded={16} />
            <View className="flex-1 gap-2.5 pt-1">
                <Skeleton width="80%" height={20} rounded={4} />
                <Skeleton width={100} height={13} rounded={4} />
                <View className="flex-row flex-wrap gap-1.5 pt-1">
                    <Skeleton width={60} height={22} rounded={11} />
                    <Skeleton width={80} height={22} rounded={11} />
                </View>
            </View>
        </View>
    )
}

export default function MovieDetailScreen() {
    const { id, mediaType } = useLocalSearchParams<{ id: string; mediaType?: MediaType }>()
    const tmdbId = Number(id)
    const resolvedMediaType: MediaType = mediaType === 'tv' ? 'tv' : 'movie'

    const { session } = useAuth()
    const detailsQuery = useTitleDetails(tmdbId, resolvedMediaType)
    const libraryLookup = useLibraryEntryLookup()
    const toggleWishlist = useToggleWishlist()
    const markAsViewed = useMarkAsViewed()
    const rateTitle = useRateTitle()

    const details = detailsQuery.data
    // Defends against a stale AsyncStorage-persisted cache entry from before a field
    // existed on this shape (see queryPersister.ts's CACHE_BUSTER comment — this has
    // already happened twice for array fields on this exact query).
    const genres = details?.genres ?? []
    const seasons = details?.seasons ?? []
    const similar = details?.similar ?? []
    const libraryEntry = libraryLookup.get(`${resolvedMediaType}-${tmdbId}`)
    const isWishlist = libraryEntry?.isWishlist ?? false
    const viewingsCount = libraryEntry?.viewingsCount ?? 0
    const hasViewed = viewingsCount > 0
    const myRating = libraryEntry?.ratings.find((r) => r.userId === session?.user.id)?.rating ?? null
    const myRatingColor = session?.user.id === MAEVA_USER_ID ? MAEVA_RATING_COLOR : VALENTIN_RATING_COLOR
    // Fixed by identity rather than "whoever isn't me", so the partner's row still shows
    // (empty/disabled) even before they've rated anything — not derivable from `ratings`
    // alone if they have no entry yet.
    const partnerUserId = session?.user.id === MAEVA_USER_ID ? VALENTIN_USER_ID : MAEVA_USER_ID
    const partnerName = partnerUserId === MAEVA_USER_ID ? 'Maeva' : 'Valentin'
    const partnerRatingColor = partnerUserId === MAEVA_USER_ID ? MAEVA_RATING_COLOR : VALENTIN_RATING_COLOR
    const partnerRating = libraryEntry?.ratings.find((r) => r.userId === partnerUserId)?.rating ?? null

    const releaseLabel = useMemo(() => formatReleaseDate(details?.releaseDate ?? null), [ details?.releaseDate ])
    const runtimeLabel = formatRuntime(details?.runtimeMinutes ?? null)
    const seasonsLabel = formatSeasons(details?.numberOfSeasons ?? null, details?.numberOfEpisodes ?? null)
    const durationLabel = runtimeLabel ?? seasonsLabel

    function handleWishlistPress() {
        if (!details) return
        Haptics.selectionAsync()
        toggleWishlist.mutate(
            { item: details, isWishlist: !isWishlist },
            { onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
        )
    }

    function handleViewedPress() {
        if (!details) return
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        markAsViewed.mutate(details, {
            onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
            onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
        })
    }

    function handleRatePress(rating: number) {
        if (!details) return
        Haptics.selectionAsync()
        rateTitle.mutate(
            { item: details, rating, userId: session?.user.id },
            {
                onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
                onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
            },
        )
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <View className="mb-2 px-5">
                <Pressable onPress={() => router.back()} hitSlop={8} className="self-start active:opacity-60">
                    <ChevronLeft size={26} color="#FFFFFF" />
                </Pressable>
            </View>

            {detailsQuery.isLoading ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
                    <DetailSkeleton />
                </ScrollView>
            ) : detailsQuery.isError || !details ? (
                <View className="flex-1 items-center justify-center px-10">
                    <Text className="text-center text-[15px] text-content-tertiary">
                        Impossible de charger ce titre.
                    </Text>
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
                    <Animated.View entering={FadeIn.duration(300)} className="flex-row items-start gap-4 px-5">
                        <View className="overflow-hidden rounded-card bg-surface" style={{ width: COVER_WIDTH }}>
                            <Image
                                source={{ uri: details.posterUrl ?? undefined }}
                                style={{ width: COVER_WIDTH, height: COVER_WIDTH * COVER_ASPECT_RATIO }}
                                contentFit="cover"
                                transition={200}
                            />
                        </View>

                        <View className="flex-1 gap-2.5">
                            <Text className="text-[20px] font-bold text-content-primary">{details.title}</Text>
                            {details.tagline ? (
                                <Text className="text-[12px] italic text-content-tertiary">{details.tagline}</Text>
                            ) : null}

                            {details.rating || releaseLabel || durationLabel ? (
                                <View className="gap-1">
                                    {details.rating ? (
                                        <View className="flex-row items-center gap-1">
                                            <Star size={13} color="#FFD60A" fill="#FFD60A" />
                                            <Text className="text-[13px] font-semibold text-content-primary">
                                                {details.rating.toFixed(1)}
                                            </Text>
                                            {details.voteCount ? (
                                                <Text className="text-[12px] text-content-tertiary">
                                                    ({details.voteCount} avis)
                                                </Text>
                                            ) : null}
                                        </View>
                                    ) : null}
                                    {releaseLabel || durationLabel ? (
                                        <Text className="text-[12px] text-content-tertiary">
                                            {[ releaseLabel, durationLabel ].filter(Boolean).join(' · ')}
                                        </Text>
                                    ) : null}
                                </View>
                            ) : null}

                            {genres.length > 0 ? (
                                <View className="flex-row flex-wrap gap-1.5">
                                    {genres.map((genre) => (
                                        <Chip key={genre} label={genre} />
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(80).duration(300)} className="mt-6 flex-row flex-wrap items-center gap-2 px-5">
                        <Pressable
                            onPress={handleWishlistPress}
                            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-60 ${
                                isWishlist ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                            }`}
                        >
                            <Heart
                                size={14}
                                color={isWishlist ? '#409CFF' : '#EBEBF599'}
                                fill={isWishlist ? '#409CFF' : 'transparent'}
                            />
                            <Text className={`text-[13px] font-medium ${isWishlist ? 'text-accent-light' : 'text-content-secondary'}`}>
                                Liste de souhait
                            </Text>
                        </Pressable>

                        {/* Info only, not tappable — the actual "mark as viewed" action is the
                            button below. Mixing "here's the state" and "tap to add a viewing"
                            into one pill made the action look like a toggle it isn't. */}
                        {hasViewed ? (
                            <View className="flex-row items-center gap-1.5 rounded-full border border-accent-light bg-accent-light/20 px-3 py-1.5">
                                <Check size={14} color="#409CFF" />
                                <Text className="text-[13px] font-medium text-accent-light">
                                    Vu{viewingsCount > 1 ? ` · ${viewingsCount}×` : ''}
                                </Text>
                            </View>
                        ) : null}
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(100).duration(300)} className="mt-3 px-5">
                        <Pressable
                            onPress={handleViewedPress}
                            className="flex-row items-center justify-center gap-2 self-start rounded-2xl bg-accent px-4 py-2.5 active:opacity-70"
                        >
                            <Check size={16} color="#FFFFFF" />
                            <Text className="text-[14px] font-semibold text-content-primary">
                                {hasViewed ? 'Revu (+1)' : 'Marquer comme vu'}
                            </Text>
                        </Pressable>
                    </Animated.View>

                    {hasViewed ? (
                        <Animated.View entering={FadeInDown.delay(120).duration(300)} className="mt-8 flex-row justify-between px-5">
                            <View className="gap-2">
                                <Text className="text-[17px] font-bold text-content-primary">Ta note</Text>
                                <View className="flex-row gap-1">
                                    {RATING_VALUES.map((value) => (
                                        <Pressable key={value} onPress={() => handleRatePress(value)} hitSlop={4}>
                                            <Star
                                                size={26}
                                                color={myRatingColor}
                                                fill={myRating !== null && value <= myRating ? myRatingColor : 'transparent'}
                                            />
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <View className="gap-2">
                                <Text className="text-[17px] font-bold text-content-primary">Note de {partnerName}</Text>
                                <View className="flex-row gap-1">
                                    {RATING_VALUES.map((value) => (
                                        <Star
                                            key={value}
                                            size={26}
                                            color={partnerRatingColor}
                                            fill={partnerRating !== null && value <= partnerRating ? partnerRatingColor : 'transparent'}
                                        />
                                    ))}
                                </View>
                            </View>
                        </Animated.View>
                    ) : null}

                    {details.overview ? (
                        <Animated.View entering={FadeInDown.delay(160).duration(300)} className="mt-8 gap-2 px-5">
                            <Text className="text-[17px] font-bold text-content-primary">Synopsis</Text>
                            <Text className="text-[14px] leading-5 text-content-secondary">{details.overview}</Text>
                        </Animated.View>
                    ) : null}

                    {/* Display-only for now — episode-level tracking (progress bars, marking
                        episodes watched) is a bigger, separate pass. This just shows what
                        seasons exist. */}
                    {seasons.length > 0 ? (
                        <Animated.View entering={FadeInDown.delay(200).duration(300)} className="mt-8 gap-3">
                            <Text className="px-5 text-[17px] font-bold text-content-primary">Saisons</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}
                            >
                                {seasons.map((season) => (
                                    <View key={season.seasonNumber} style={{ width: SEASON_CARD_WIDTH }}>
                                        <View className="overflow-hidden rounded-card bg-surface">
                                            <Image
                                                source={{ uri: (season.posterUrl ?? details.posterUrl) ?? undefined }}
                                                style={{ width: SEASON_CARD_WIDTH, height: SEASON_CARD_WIDTH * COVER_ASPECT_RATIO }}
                                                contentFit="cover"
                                                transition={200}
                                            />
                                        </View>
                                        <Text numberOfLines={1} className="mt-1.5 text-[13px] font-medium text-content-primary">
                                            {season.name}
                                        </Text>
                                        <Text className="text-[11px] text-content-tertiary">
                                            {season.episodeCount} épisode{season.episodeCount > 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                ))}
                            </ScrollView>
                        </Animated.View>
                    ) : null}

                    {similar.length > 0 ? (
                        <Animated.View entering={FadeInDown.delay(200).duration(300)} className="mt-8 gap-3">
                            <Text className="px-5 text-[17px] font-bold text-content-primary">Titres similaires</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}
                            >
                                {similar.map((item) => (
                                    <BrowseMovieCard
                                        key={`${item.mediaType}-${item.tmdbId}`}
                                        item={item}
                                        width={SIMILAR_CARD_WIDTH}
                                        libraryEntry={libraryLookup.get(`${item.mediaType}-${item.tmdbId}`) ?? null}
                                    />
                                ))}
                            </ScrollView>
                        </Animated.View>
                    ) : null}
                </ScrollView>
            )}
        </SafeAreaView>
    )
}
