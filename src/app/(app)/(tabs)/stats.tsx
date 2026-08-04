import { useState } from 'react'
import { Dimensions, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { router } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Calendar, ChevronRight, Clapperboard, Eye, Heart, History, ListChecks, Star, Tv } from 'lucide-react-native'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatTile } from '@/components/ui/StatTile'
import { BarRow } from '@/components/ui/BarRow'
import { DonutChart } from '@/components/ui/DonutChart'
import { MonthlyTrendChart } from '@/components/ui/MonthlyTrendChart'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMovieStats, type MovieStats } from '@/features/stats/useMovieStats'
import { MAEVA_RATING_COLOR, VALENTIN_RATING_COLOR } from '@/constants/people'

const HORIZONTAL_PADDING = 20
const CARD_PADDING = 16
const CHART_WIDTH = Dimensions.get('window').width - HORIZONTAL_PADDING * 2 - CARD_PADDING * 2

const MOVIES_COLOR = '#409CFF'
const SHOWS_COLOR = '#BF5AF2'
const GENRE_COLORS = [ '#409CFF', '#BF5AF2', '#30D158', '#FF9F0A', '#FF453A', '#FF2D55', '#FFD60A', '#64D2FF' ]
const RATING_BAR_HEIGHT = 130

function RatingDistributionChart({ data }: { data: MovieStats[ 'ratingDistribution' ] }) {
    const maxCount = Math.max(...data.flatMap((d) => [ d.valentinCount, d.maevaCount ]), 1)

    return (
        <View>
            <View className="flex-row items-end justify-between" style={{ height: RATING_BAR_HEIGHT }}>
                {data.map((d) => (
                    <View key={d.value} className="flex-1 flex-row items-end justify-center gap-1.5">
                        <View
                            className="w-3.5 rounded-t-md"
                            style={{ height: Math.max((d.maevaCount / maxCount) * RATING_BAR_HEIGHT, 2), backgroundColor: MAEVA_RATING_COLOR }}
                        />
                        <View
                            className="w-3.5 rounded-t-md"
                            style={{ height: Math.max((d.valentinCount / maxCount) * RATING_BAR_HEIGHT, 2), backgroundColor: VALENTIN_RATING_COLOR }}
                        />
                    </View>
                ))}
            </View>
            <View className="mt-2 flex-row justify-between">
                {data.map((d) => (
                    <Text key={d.value} className="flex-1 text-center text-[11px] text-content-tertiary">
                        {d.value}★
                    </Text>
                ))}
            </View>
        </View>
    )
}

function StatsSkeleton() {
    return (
        <View>
            <Skeleton width={160} height={28} rounded={6} />
            <View className="mb-4 mt-6 flex-row gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                    <View key={index} className="flex-1 items-center gap-1.5 rounded-2xl border border-border-subtle bg-surface py-4">
                        <Skeleton width={18} height={18} rounded={9} />
                        <Skeleton width={28} height={20} rounded={4} />
                        <Skeleton width={40} height={11} rounded={4} />
                    </View>
                ))}
            </View>
            <View className="mb-8 flex-row gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                    <View key={index} className="flex-1 items-center gap-1.5 rounded-2xl border border-border-subtle bg-surface py-4">
                        <Skeleton width={18} height={18} rounded={9} />
                        <Skeleton width={28} height={20} rounded={4} />
                        <Skeleton width={40} height={11} rounded={4} />
                    </View>
                ))}
            </View>
            <View className="mb-8 items-center gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
                <Skeleton width={180} height={180} rounded={90} />
            </View>
            <View className="rounded-2xl border border-border-subtle bg-surface p-4">
                <Skeleton height={120} rounded={12} />
            </View>
        </View>
    )
}

export default function StatsScreen() {
    const tabBarHeight = useBottomTabBarHeight()
    const { stats, isLoading, isError, refetch } = useMovieStats()
    const [ isRefreshing, setIsRefreshing ] = useState(false)

    async function handleRefresh() {
        setIsRefreshing(true)
        await refetch()
        setIsRefreshing(false)
    }

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 12, paddingBottom: tabBarHeight + 24 }}
                >
                    <StatsSkeleton />
                </ScrollView>
            </SafeAreaView>
        )
    }

    if (isError) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background px-10" edges={[ 'top' ]}>
                <Text className="text-center text-[15px] text-content-tertiary">
                    Impossible de charger tes statistiques.
                </Text>
            </SafeAreaView>
        )
    }

    if (stats.totalWatchedCount === 0 && stats.toWatchCount === 0) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background px-10" edges={[ 'top' ]}>
                <Text className="text-center text-[15px] text-content-tertiary">
                    Ajoute des titres à votre bibliothèque pour voir vos statistiques.
                </Text>
            </SafeAreaView>
        )
    }

    const genreDonutData = stats.byGenre.map((item, index) => ({
        label: item.genre,
        value: item.count,
        color: GENRE_COLORS[ index % GENRE_COLORS.length ] as string,
    }))
    if (stats.otherGenresCount > 0) {
        genreDonutData.push({ label: 'Autres', value: stats.otherGenresCount, color: '#8E8E93' })
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 12, paddingBottom: tabBarHeight + 24 }}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#409CFF" />}
            >
                <Text className="mb-6 text-[28px] font-bold text-content-primary">Statistiques</Text>

                <Pressable
                    onPress={() => router.push('/history')}
                    className="mb-8 flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3.5 active:opacity-70"
                >
                    <History size={20} color="#409CFF" />
                    <Text className="flex-1 text-[15px] font-semibold text-content-primary">Mon historique</Text>
                    <ChevronRight size={18} color="#8E8E93" />
                </Pressable>

                <Animated.View entering={FadeInDown.delay(60).duration(400)} className="mb-3 flex-row gap-3">
                    <StatTile label="Films vus" value={stats.moviesWatchedCount} icon={Clapperboard} color={MOVIES_COLOR} />
                    <StatTile label="Séries vues" value={stats.showsWatchedCount} icon={Tv} color={SHOWS_COLOR} />
                    <StatTile label="À voir" value={stats.toWatchCount} icon={Heart} color="#FF453A" />
                    <StatTile label="Total vus" value={stats.totalWatchedCount} icon={Eye} color="#30D158" />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-8 flex-row gap-3">
                    <StatTile
                        label="Moyenne Valentin"
                        value={stats.valentinAverageRating !== null ? Number(stats.valentinAverageRating.toFixed(1)) : 0}
                        icon={Star}
                        color={VALENTIN_RATING_COLOR}
                        caption={stats.valentinAverageRating !== null ? '/ 5' : 'Aucune note'}
                    />
                    <StatTile
                        label="Moyenne Maëva"
                        value={stats.maevaAverageRating !== null ? Number(stats.maevaAverageRating.toFixed(1)) : 0}
                        icon={Star}
                        color={MAEVA_RATING_COLOR}
                        caption={stats.maevaAverageRating !== null ? '/ 5' : 'Aucune note'}
                    />
                    <StatTile label="Épisodes vus" value={stats.episodesWatchedCount} icon={ListChecks} color="#FF9F0A" />
                    <StatTile label="Séries en cours" value={stats.showsInProgressCount} icon={Tv} color="#64D2FF" />
                </Animated.View>

                {stats.totalWatchedCount > 0 ? (
                    <Animated.View entering={FadeInDown.delay(140).duration(400)} className="mb-8">
                        <SectionHeader title="Films vs Séries" />
                        <View className="items-center rounded-2xl border border-border-subtle bg-surface p-4">
                            <DonutChart
                                data={[
                                    { label: 'Films', value: stats.moviesWatchedCount, color: MOVIES_COLOR },
                                    { label: 'Séries', value: stats.showsWatchedCount, color: SHOWS_COLOR },
                                ]}
                                centerCaption="total"
                            />
                        </View>
                    </Animated.View>
                ) : null}

                {genreDonutData.length > 0 ? (
                    <Animated.View entering={FadeInDown.delay(180).duration(400)} className="mb-8">
                        <SectionHeader title="Genres les plus regardés" />
                        <View className="items-center rounded-2xl border border-border-subtle bg-surface p-4">
                            <DonutChart data={genreDonutData} centerCaption="titres" />
                        </View>
                    </Animated.View>
                ) : null}

                <Animated.View entering={FadeInDown.delay(220).duration(400)} className="mb-8">
                    <SectionHeader title="Activité dans le temps" />
                    <View className="rounded-2xl border border-border-subtle bg-surface p-4">
                        <MonthlyTrendChart data={stats.activityByMonth} width={CHART_WIDTH} />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(260).duration(400)} className="mb-8">
                    <SectionHeader title="Distribution des notes" />
                    <View className="rounded-2xl border border-border-subtle bg-surface p-4">
                        <View className="mb-3 flex-row justify-end gap-4">
                            <View className="flex-row items-center gap-1.5">
                                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MAEVA_RATING_COLOR }} />
                                <Text className="text-[12px] text-content-secondary">Maëva</Text>
                            </View>
                            <View className="flex-row items-center gap-1.5">
                                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: VALENTIN_RATING_COLOR }} />
                                <Text className="text-[12px] text-content-secondary">Valentin</Text>
                            </View>
                        </View>
                        <RatingDistributionChart data={stats.ratingDistribution} />
                    </View>
                </Animated.View>

                {stats.topShowByEpisodes ? (
                    <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-3">
                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: '/movie/[id]',
                                    params: { id: String(stats.topShowByEpisodes?.tmdbId), mediaType: 'tv' },
                                })
                            }
                            className="flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3.5 active:opacity-70"
                        >
                            <Tv size={20} color="#BF5AF2" />
                            <Text className="flex-1 text-[15px] text-content-primary" numberOfLines={1}>
                                <Text className="font-semibold">Série la plus regardée : </Text>
                                {stats.topShowByEpisodes.name} ({stats.topShowByEpisodes.count} épisodes)
                            </Text>
                            <ChevronRight size={18} color="#8E8E93" />
                        </Pressable>
                    </Animated.View>
                ) : null}

                {stats.addedThisMonthCount > 0 ? (
                    <Animated.View entering={FadeInDown.delay(330).duration(400)}>
                        <View className="flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3.5">
                            <Calendar size={20} color="#409CFF" />
                            <Text className="flex-1 text-[15px] text-content-primary">
                                <Text className="font-semibold">{stats.addedThisMonthCount}</Text> titre
                                {stats.addedThisMonthCount > 1 ? 's' : ''} ajouté{stats.addedThisMonthCount > 1 ? 's' : ''} ce mois-ci
                            </Text>
                        </View>
                    </Animated.View>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    )
}
