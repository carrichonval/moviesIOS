import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Check, CheckCheck, ChevronLeft } from 'lucide-react-native'
import { ConfettiBurst } from '@/components/ui/ConfettiBurst'
import { Skeleton } from '@/components/ui/Skeleton'
import {
    useLibraryEntryLookup,
    useMarkEpisodesWatched,
    useSeasonWatchesQuery,
    useToggleEpisodeWatched,
} from '@/features/movies/api/library'
import { useSeasonDetails, useTitleDetails } from '@/features/movies/hooks/useTmdbBrowse'
import type { TmdbEpisodeSummary } from '@/types/tmdb'

const STILL_WIDTH = 100
const STILL_ASPECT_RATIO = 9 / 16 // TMDB stills are 16:9 (width:height)

function formatAirDate(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SeasonSkeleton() {
    return (
        <View className="gap-4 px-2.5">
            {Array.from({ length: 6 }).map((_, index) => (
                <View key={index} className="flex-row items-center gap-3">
                    <Skeleton width={STILL_WIDTH} height={STILL_WIDTH * STILL_ASPECT_RATIO} rounded={12} />
                    <View className="flex-1 gap-1.5">
                        <Skeleton width="70%" height={14} rounded={4} />
                        <Skeleton width="40%" height={12} rounded={4} />
                    </View>
                </View>
            ))}
        </View>
    )
}

interface EpisodeRowProps {
    episode: TmdbEpisodeSummary;
    watched: boolean;
    onToggle: () => void;
}

function EpisodeRow({ episode, watched, onToggle }: EpisodeRowProps) {
    const airDateLabel = formatAirDate(episode.airDate)

    return (
        <Pressable
            onPress={onToggle}
            className={`flex-row items-center gap-3 rounded-2xl border p-2 active:opacity-70 ${
                watched ? 'border-accent-light bg-accent-light/10' : 'border-border-subtle bg-surface'
            }`}
        >
            <View className="overflow-hidden rounded-xl bg-background" style={{ width: STILL_WIDTH }}>
                <Image
                    source={{ uri: episode.stillUrl ?? undefined }}
                    style={{ width: STILL_WIDTH, height: STILL_WIDTH * STILL_ASPECT_RATIO }}
                    contentFit="cover"
                    transition={200}
                />
            </View>
            <View className="flex-1 gap-1">
                <Text numberOfLines={1} className="text-[13px] font-semibold text-content-primary">
                    {episode.episodeNumber}. {episode.name}
                </Text>
                {airDateLabel ? <Text className="text-[11px] text-content-tertiary">{airDateLabel}</Text> : null}
            </View>
            <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                    watched ? 'bg-accent-light' : 'border border-border-subtle bg-background'
                }`}
            >
                <Check size={16} color={watched ? '#FFFFFF' : '#EBEBF599'} />
            </View>
        </Pressable>
    )
}

export default function SeasonScreen() {
    const { id, seasonNumber } = useLocalSearchParams<{ id: string; seasonNumber: string }>()
    const tvId = Number(id)
    const resolvedSeasonNumber = Number(seasonNumber)

    const detailsQuery = useTitleDetails(tvId, 'tv')
    const seasonQuery = useSeasonDetails(tvId, resolvedSeasonNumber)
    const libraryLookup = useLibraryEntryLookup()
    const libraryEntry = libraryLookup.get(`tv-${tvId}`) ?? null
    const watchesQuery = useSeasonWatchesQuery(libraryEntry?.libraryEntryId ?? null, resolvedSeasonNumber)
    const toggleEpisodeWatched = useToggleEpisodeWatched()
    const markEpisodesWatched = useMarkEpisodesWatched()

    const details = detailsQuery.data
    const season = seasonQuery.data
    const episodes = season?.episodes ?? []
    // `watchesQuery.data` is a plain array (see fetchEpisodeWatches's comment) — a `Set`
    // built here, at render time, never touches the persisted cache.
    const watchedEpisodes = useMemo(() => new Set(watchesQuery.data ?? []), [ watchesQuery.data ])
    const watchedCount = watchedEpisodes.size
    const [ showConfetti, setShowConfetti ] = useState(false)

    // Fires only on the action that actually flips the season from incomplete to complete
    // — `newlyMarkedCount` is how many not-yet-watched episodes this specific action is
    // about to mark, computed by each call site from its own "not yet watched" set, so this
    // doesn't need to wait for the query to refetch to know the outcome.
    function checkSeasonCompletion(newlyMarkedCount: number) {
        if (episodes.length > 0 && watchedCount < episodes.length && watchedCount + newlyMarkedCount >= episodes.length) {
            setShowConfetti(true)
        }
    }

    function markSingleEpisode(episodeNumber: number, watched: boolean) {
        if (!details) return
        Haptics.selectionAsync()
        toggleEpisodeWatched.mutate(
            { item: details, seasonNumber: resolvedSeasonNumber, episodeNumber, watched },
            {
                onSuccess: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                    if (watched) checkSeasonCompletion(1)
                },
                onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
            },
        )
    }

    function handleToggleEpisode(episodeNumber: number) {
        if (!details) return

        // Unchecking never offers to catch up — only marking as watched does.
        if (watchedEpisodes.has(episodeNumber)) {
            markSingleEpisode(episodeNumber, false)
            return
        }

        const earlierUnwatched = episodes
            .map((episode) => episode.episodeNumber)
            .filter((number) => number < episodeNumber && !watchedEpisodes.has(number))

        if (earlierUnwatched.length === 0) {
            markSingleEpisode(episodeNumber, true)
            return
        }

        Alert.alert(
            'Épisodes précédents ?',
            `Tu n'as pas encore coché les épisodes 1 à ${episodeNumber - 1} de cette saison. Les marquer vus aussi ?`,
            [
                { text: 'Non, juste celui-ci', onPress: () => markSingleEpisode(episodeNumber, true) },
                {
                    text: `Oui, 1 à ${episodeNumber}`,
                    onPress: () => {
                        if (!details) return
                        Haptics.selectionAsync()
                        const episodeNumbers = [ ...earlierUnwatched, episodeNumber ]
                        markEpisodesWatched.mutate(
                            { item: details, seasonNumber: resolvedSeasonNumber, episodeNumbers },
                            {
                                onSuccess: () => {
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                                    checkSeasonCompletion(episodeNumbers.length)
                                },
                                onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
                            },
                        )
                    },
                },
            ],
        )
    }

    // Always neutral (dated on when the show was added, not "now") — for backfilling a
    // season you'd already seen before per-episode tracking existed, so it doesn't jump to
    // the top of "Vu" as if you'd just watched the whole thing today. Genuine real-time
    // catch-up (episode by episode, or the "catch up to here" prompt above) still dates
    // itself "now" — this button is specifically for "I know I finished this, just record
    // it", not for actually watching it right now.
    function handleMarkAllWatched() {
        if (!details) return
        const remaining = episodes.map((episode) => episode.episodeNumber).filter((number) => !watchedEpisodes.has(number))
        if (remaining.length === 0) return

        Haptics.selectionAsync()
        markEpisodesWatched.mutate(
            {
                item: details,
                seasonNumber: resolvedSeasonNumber,
                episodeNumbers: remaining,
                watchedAt: libraryEntry?.addedAt,
            },
            {
                onSuccess: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                    checkSeasonCompletion(remaining.length)
                },
                onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
            },
        )
    }

    const isLoading = detailsQuery.isLoading || seasonQuery.isLoading

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <View className="mb-2 flex-row items-center justify-between px-2.5">
                <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
                    <ChevronLeft size={26} color="#FFFFFF" />
                </Pressable>
                {!isLoading && episodes.length > 0 && watchedCount < episodes.length ? (
                    <Pressable
                        onPress={handleMarkAllWatched}
                        className="flex-row items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1.5 active:opacity-70"
                    >
                        <CheckCheck size={14} color="#409CFF" />
                        <Text className="text-[13px] font-medium text-accent-light">Tout marquer vu</Text>
                    </Pressable>
                ) : null}
            </View>

            {isLoading ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
                    <SeasonSkeleton />
                </ScrollView>
            ) : seasonQuery.isError || !season || !details ? (
                <View className="flex-1 items-center justify-center px-10">
                    <Text className="text-center text-[15px] text-content-tertiary">
                        Impossible de charger cette saison.
                    </Text>
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
                    <Animated.View entering={FadeIn.duration(300)} className="gap-1 px-2.5">
                        <Text className="text-[13px] font-medium text-content-tertiary">{details.title}</Text>
                        <Text className="text-[22px] font-bold text-content-primary">{season.name}</Text>
                        <Text className="text-[13px] text-content-secondary">
                            {watchedCount}/{episodes.length} épisode{episodes.length > 1 ? 's' : ''} vu
                            {watchedCount > 1 ? 's' : ''}
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(80).duration(300)} className="mt-5 gap-2.5 px-2.5">
                        {episodes.map((episode) => (
                            <EpisodeRow
                                key={episode.episodeNumber}
                                episode={episode}
                                watched={watchedEpisodes.has(episode.episodeNumber)}
                                onToggle={() => handleToggleEpisode(episode.episodeNumber)}
                            />
                        ))}
                    </Animated.View>
                </ScrollView>
            )}

            {showConfetti ? <ConfettiBurst onComplete={() => setShowConfetti(false)} /> : null}
        </SafeAreaView>
    )
}
