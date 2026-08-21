import { ActivityIndicator, Dimensions, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ChevronLeft } from 'lucide-react-native'
import { useFavoriteProviderIds, useToggleFavoriteProvider } from '@/features/movies/api/watchProviders'
import { useWatchProviderCatalog } from '@/features/movies/hooks/useTmdbBrowse'

const LOGO_SIZE = 56
// Fixed columns, same technique as the movie grids (index.tsx/search.tsx) — every row gets
// the same number of equal-width slots, so a partial last row just leaves empty space
// instead of stretching 3 items across the full width (justify-between) or leaving one
// big gap on the right (plain flex-wrap with no fixed slot width).
const GRID_COLUMNS = 5
const GRID_HORIZONTAL_PADDING = 10
const GRID_GAP = 14
const COLUMN_WIDTH =
    (Dimensions.get('window').width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS

export default function WatchProvidersScreen() {
    const { data: catalog, isLoading, isError } = useWatchProviderCatalog()
    const favoriteProviderIds = useFavoriteProviderIds()
    const toggleFavorite = useToggleFavoriteProvider()

    function handleToggle(provider: NonNullable<typeof catalog>[number]) {
        Haptics.selectionAsync()
        toggleFavorite.mutate({ provider, isFavorite: !favoriteProviderIds.has(provider.providerId) })
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <View className="mb-4 flex-row items-center gap-3 px-2.5">
                <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
                    <ChevronLeft size={26} color="#FFFFFF" />
                </Pressable>
                <Text className="flex-1 text-[20px] font-bold text-content-primary">Plateformes favorites</Text>
            </View>

            <Text className="mb-5 px-2.5 text-[13px] text-content-secondary">
                Les plateformes que tu coches ici seront mises en avant (bordure jaune) sur la fiche d'un film ou
                d'une série quand il y est disponible en abonnement.
            </Text>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#409CFF" />
                </View>
            ) : isError || !catalog?.length ? (
                <View className="flex-1 items-center justify-center px-10">
                    <Text className="text-center text-[15px] text-content-tertiary">
                        Impossible de charger la liste des plateformes.
                    </Text>
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                    <View className="flex-row flex-wrap px-2.5" style={{ gap: GRID_GAP }}>
                        {catalog.map((provider) => {
                            const isFavorite = favoriteProviderIds.has(provider.providerId)
                            return (
                                <Pressable
                                    key={provider.providerId}
                                    onPress={() => handleToggle(provider)}
                                    className="items-center gap-1.5"
                                    style={{ width: COLUMN_WIDTH }}
                                >
                                    <View
                                        className={`overflow-hidden rounded-xl bg-surface ${
                                            isFavorite ? 'border-2 border-accent-light' : ''
                                        }`}
                                    >
                                        <Image
                                            source={{ uri: provider.logoUrl ?? undefined }}
                                            style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
                                            contentFit="cover"
                                        />
                                    </View>
                                    <Text
                                        numberOfLines={2}
                                        className={`text-center text-[11px] ${
                                            isFavorite ? 'font-medium text-accent-light' : 'text-content-tertiary'
                                        }`}
                                    >
                                        {provider.name}
                                    </Text>
                                </Pressable>
                            )
                        })}
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    )
}
