import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ChevronLeft, History } from 'lucide-react-native'
import { Skeleton } from '@/components/ui/Skeleton'
import { getMovieEventDisplay } from '@/constants/movieEvents'
import { useMovieTimeline, type MovieActivityEvent, type TimelineSection } from '@/features/movies/hooks/useMovieTimeline'

const NODE_SIZE = 30
const COVER_WIDTH = 40
const COVER_HEIGHT = Math.round(COVER_WIDTH * 1.5) // TMDB posters are 2:3

type TimelineListItem =
    | { kind: 'header'; key: string; label: string }
    | { kind: 'event'; key: string; event: MovieActivityEvent; isFirstInGroup: boolean; isLastInGroup: boolean }

// A single-event group still has to hand back a real 1-length `events` array (never
// skip pushing it), and isFirstInGroup/isLastInGroup are correctly both true in that
// case — the row itself doesn't require a neighbor to render.
function flattenSections(sections: TimelineSection[]): TimelineListItem[] {
    const items: TimelineListItem[] = []

    for (const section of sections) {
        items.push({ kind: 'header', key: `header-${section.key}`, label: section.label })
        section.events.forEach((event, index) => {
            items.push({
                kind: 'event',
                key: event.id,
                event,
                isFirstInGroup: index === 0,
                isLastInGroup: index === section.events.length - 1,
            })
        })
    }

    return items
}

function TimelineSectionHeader({ label }: { label: string }) {
    return (
        <View className="bg-background px-5 pb-2 pt-5">
            <Text className="text-[13px] font-semibold uppercase tracking-wide text-content-secondary">{label}</Text>
        </View>
    )
}

function TimelineEventRow({ event, isFirstInGroup, isLastInGroup }: {
    event: MovieActivityEvent;
    isFirstInGroup: boolean;
    isLastInGroup: boolean;
}) {
    const { label, icon: Icon, color } = getMovieEventDisplay(event)

    return (
        <View className="flex-row px-5">
            <View className="items-center" style={{ width: NODE_SIZE }}>
                <View className="w-px flex-1 bg-border-subtle" style={{ opacity: isFirstInGroup ? 0 : 1 }} />
                <View
                    className="items-center justify-center rounded-full border border-border-subtle bg-surface"
                    style={{ width: NODE_SIZE, height: NODE_SIZE }}
                >
                    <Icon size={15} color={color} />
                </View>
                <View className="w-px flex-1 bg-border-subtle" style={{ opacity: isLastInGroup ? 0 : 1 }} />
            </View>

            <View className="ml-3 flex-1 flex-row items-center gap-3 py-3">
                <View className="overflow-hidden rounded-md bg-surface-elevated">
                    <Image
                        source={{ uri: event.title.posterUrl ?? undefined }}
                        style={{ width: COVER_WIDTH, height: COVER_HEIGHT }}
                        contentFit="cover"
                        transition={150}
                    />
                </View>
                <Text className="flex-1 text-[14px] leading-5 text-content-secondary" numberOfLines={2}>
                    <Text className="font-semibold" style={{ color }}>
                        {label}{' '}
                    </Text>
                    <Text className="font-semibold text-content-primary">{event.title.name}</Text>
                </Text>
            </View>
        </View>
    )
}

function HistorySkeleton() {
    return (
        <View className="gap-4 px-5 pt-2">
            {Array.from({ length: 6 }).map((_, index) => (
                <View key={index} className="flex-row items-center gap-3">
                    <Skeleton width={NODE_SIZE} height={NODE_SIZE} rounded={NODE_SIZE / 2} />
                    <Skeleton width={COVER_WIDTH} height={COVER_HEIGHT} rounded={6} />
                    <Skeleton width={160} height={14} rounded={4} />
                </View>
            ))}
        </View>
    )
}

export default function HistoryScreen() {
    const { sections, isEmpty, isLoading, isError, refetch } = useMovieTimeline()
    const items = useMemo(() => flattenSections(sections), [ sections ])
    const [ isRefreshing, setIsRefreshing ] = useState(false)

    async function handleRefresh() {
        setIsRefreshing(true)
        await refetch()
        setIsRefreshing(false)
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top', 'bottom' ]}>
            <View className="mb-2 flex-row items-center gap-3 px-5">
                <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
                    <ChevronLeft size={26} color="#FFFFFF" />
                </Pressable>
                <Text className="flex-1 text-[20px] font-bold text-content-primary">Historique</Text>
            </View>

            {isLoading ? (
                <HistorySkeleton />
            ) : isError ? (
                <View className="flex-1 items-center justify-center px-10">
                    <Text className="text-center text-[15px] text-content-tertiary">
                        Impossible de charger ton historique.
                    </Text>
                </View>
            ) : isEmpty ? (
                <View className="flex-1 items-center justify-center px-10">
                    <History size={32} color="#8E8E93" />
                    <Text className="mt-3 text-center text-[15px] text-content-tertiary">
                        Ton historique apparaîtra ici au fil de tes actions sur la bibliothèque.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.key}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#409CFF" />
                    }
                    renderItem={({ item }) =>
                        item.kind === 'header' ? (
                            <TimelineSectionHeader label={item.label} />
                        ) : (
                            <TimelineEventRow
                                event={item.event}
                                isFirstInGroup={item.isFirstInGroup}
                                isLastInGroup={item.isLastInGroup}
                            />
                        )
                    }
                />
            )}
        </SafeAreaView>
    )
}
