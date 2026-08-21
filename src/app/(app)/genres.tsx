import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { ChevronLeft } from 'lucide-react-native'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { BrowseMovieCard } from '@/features/movies/components/BrowseMovieCard'
import { useLibraryEntryLookup, type MovieLibraryEntry } from '@/features/movies/api/library'
import { useGenres, useTitlesByGenre } from '@/features/movies/hooks/useTmdbBrowse'
import type { MediaType } from '@/types/tmdb'

const CATEGORY_TABS: { key: MediaType; label: string }[] = [
    { key: 'movie', label: 'Films' },
    { key: 'tv', label: 'Séries' },
]

const ROW_CARD_WIDTH = 110

function GenreRow({ genreId, name, mediaType, delay, libraryLookup }: {
    genreId: number;
    name: string;
    mediaType: MediaType;
    delay: number;
    libraryLookup: Map<string, MovieLibraryEntry>;
}) {
    const { data: items, isLoading, isError } = useTitlesByGenre(genreId, mediaType)

    return (
        <Animated.View entering={FadeInDown.delay(delay).duration(400)} className="mb-8">
            <SectionHeader
                title={name}
                onPressSeeAll={() =>
                    router.push({
                        pathname: '/browse/[section]',
                        params: { section: 'genre', genreId, genreName: name, mediaType },
                    })
                }
            />
            {isLoading ? (
                <View className="h-[165px] items-center justify-center">
                    <ActivityIndicator color="#409CFF" />
                </View>
            ) : isError || !items?.length ? (
                <View className="h-[165px] items-center justify-center px-2.5">
                    <Text className="text-center text-[13px] text-content-tertiary">
                        Rien à afficher pour l'instant.
                    </Text>
                </View>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ overflow: 'visible' }}
                    contentContainerStyle={{ gap: 14, paddingHorizontal: 10 }}
                >
                    {items.map((item) => (
                        <BrowseMovieCard
                            key={`${item.mediaType}-${item.tmdbId}`}
                            item={item}
                            width={ROW_CARD_WIDTH}
                            libraryEntry={libraryLookup.get(`${item.mediaType}-${item.tmdbId}`) ?? null}
                        />
                    ))}
                </ScrollView>
            )}
        </Animated.View>
    )
}

export default function GenresScreen() {
    const [ mediaType, setMediaType ] = useState<MediaType>('movie')
    const { data: genres, isLoading, isError } = useGenres(mediaType)
    const libraryLookup = useLibraryEntryLookup()

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <View className="mb-4 flex-row items-center gap-3 px-2.5">
                <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
                    <ChevronLeft size={26} color="#FFFFFF" />
                </Pressable>
                <Text className="flex-1 text-[20px] font-bold text-content-primary">Catégories</Text>
            </View>

            <View className="mb-6 flex-row gap-2 px-2.5">
                {CATEGORY_TABS.map((tab) => {
                    const isActive = mediaType === tab.key
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => setMediaType(tab.key)}
                            className={`flex-1 items-center rounded-full border px-3 py-2 active:opacity-60 ${
                                isActive ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                            }`}
                        >
                            <Text
                                className={`text-[13px] font-medium ${
                                    isActive ? 'text-accent-light' : 'text-content-secondary'
                                }`}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    )
                })}
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#409CFF" />
                </View>
            ) : isError || !genres?.length ? (
                <View className="flex-1 items-center justify-center px-10">
                    <Text className="text-center text-[15px] text-content-tertiary">
                        Impossible de charger les catégories.
                    </Text>
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                    {genres.map((genre, index) => (
                        <GenreRow
                            key={genre.id}
                            genreId={genre.id}
                            name={genre.name}
                            mediaType={mediaType}
                            delay={index * 40}
                            libraryLookup={libraryLookup}
                        />
                    ))}
                </ScrollView>
            )}
        </SafeAreaView>
    )
}
