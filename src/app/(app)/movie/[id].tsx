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
import { useAuth } from '@/features/auth/AuthProvider'
import { useLibraryQuery, useMarkAsViewed, useRateTitle, useToggleWishlist } from '@/features/movies/api/library'
import { useTitleDetails } from '@/features/movies/hooks/useTmdbBrowse'
import type { MediaType } from '@/types/tmdb'

const COVER_WIDTH = 148
const COVER_ASPECT_RATIO = 3 / 2 // TMDB posters are 2:3 (width:height)
const SIMILAR_CARD_WIDTH = 110

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
    const libraryQuery = useLibraryQuery()
    const toggleWishlist = useToggleWishlist()
    const markAsViewed = useMarkAsViewed()
    const rateTitle = useRateTitle()

    const details = detailsQuery.data
    const libraryEntry = libraryQuery.data?.find(
        (entry) => entry.tmdbId === tmdbId && entry.mediaType === resolvedMediaType,
    )
    const isWishlist = libraryEntry?.isWishlist ?? false
    const hasViewed = (libraryEntry?.viewingsCount ?? 0) > 0
    const myRating = libraryEntry?.ratings.find((r) => r.userId === session?.user.id)?.rating ?? null
    const partnerRating = libraryEntry?.ratings.find((r) => r.userId !== session?.user.id)?.rating ?? null

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
            { item: details, rating },
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

                            {details.genres.length > 0 ? (
                                <View className="flex-row flex-wrap gap-1.5">
                                    {details.genres.map((genre) => (
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

                        <Pressable
                            onPress={handleViewedPress}
                            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-60 ${
                                hasViewed ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                            }`}
                        >
                            <Check size={14} color={hasViewed ? '#409CFF' : '#EBEBF599'} />
                            <Text className={`text-[13px] font-medium ${hasViewed ? 'text-accent-light' : 'text-content-secondary'}`}>
                                {hasViewed ? 'Revu' : 'Vu'}
                            </Text>
                        </Pressable>
                    </Animated.View>

                    {hasViewed ? (
                        <Animated.View entering={FadeInDown.delay(120).duration(300)} className="mt-8 gap-3 px-5">
                            <Text className="text-[17px] font-bold text-content-primary">Ta note</Text>
                            <View className="flex-row items-center gap-3">
                                <View className="flex-row gap-1">
                                    {RATING_VALUES.map((value) => (
                                        <Pressable key={value} onPress={() => handleRatePress(value)} hitSlop={4}>
                                            <Star
                                                size={26}
                                                color="#FFD60A"
                                                fill={myRating !== null && value <= myRating ? '#FFD60A' : 'transparent'}
                                            />
                                        </Pressable>
                                    ))}
                                </View>
                                {partnerRating ? (
                                    <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: '#FF2D55' }}>
                                        <Text className="text-[12px] font-bold text-white">{partnerRating}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </Animated.View>
                    ) : null}

                    {details.overview ? (
                        <Animated.View entering={FadeInDown.delay(160).duration(300)} className="mt-8 gap-2 px-5">
                            <Text className="text-[17px] font-bold text-content-primary">Synopsis</Text>
                            <Text className="text-[14px] leading-5 text-content-secondary">{details.overview}</Text>
                        </Animated.View>
                    ) : null}

                    {details.similar.length > 0 ? (
                        <Animated.View entering={FadeInDown.delay(200).duration(300)} className="mt-8 gap-3">
                            <Text className="px-5 text-[17px] font-bold text-content-primary">Titres similaires</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}
                            >
                                {details.similar.map((item) => (
                                    <BrowseMovieCard key={`${item.mediaType}-${item.tmdbId}`} item={item} width={SIMILAR_CARD_WIDTH} />
                                ))}
                            </ScrollView>
                        </Animated.View>
                    ) : null}
                </ScrollView>
            )}
        </SafeAreaView>
    )
}
