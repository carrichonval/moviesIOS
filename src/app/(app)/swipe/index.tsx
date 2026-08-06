import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ChevronLeft, Heart, Sparkles } from 'lucide-react-native'
import { useGenres } from '@/features/movies/hooks/useTmdbBrowse'
import type { MediaType } from '@/types/tmdb'

type Source = 'wishlist' | 'discover'

const CATEGORY_TABS: { key: MediaType; label: string }[] = [
    { key: 'movie', label: 'Films' },
    { key: 'tv', label: 'Séries' },
]

export default function SwipeConfigScreen() {
    const [ source, setSource ] = useState<Source | null>(null)
    const [ mediaType, setMediaType ] = useState<MediaType>('movie')
    // Multi-select on purpose — "je hésite entre plusieurs genres" means "show me either",
    // not "show me only titles that are all of these at once" (that's what a plain comma in
    // TMDB's `with_genres` would mean; getTitlesByGenres uses `|` for real OR semantics).
    const [ genreIds, setGenreIds ] = useState<number[]>([])

    // Only fetched/shown once "Découverte" is picked — a genre only makes sense as a
    // discover filter, the wishlist source doesn't need one.
    const { data: genres, isLoading: isGenresLoading } = useGenres(mediaType)

    function handleSelectSource(next: Source) {
        setSource(next)
    }

    function handleSelectMediaType(next: MediaType) {
        setMediaType(next)
        setGenreIds([])
    }

    function handleToggleGenre(genreId: number) {
        setGenreIds((current) =>
            current.includes(genreId) ? current.filter((id) => id !== genreId) : [ ...current, genreId ],
        )
    }

    function handleStart() {
        if (!source) return
        const selectedGenreNames = (genres ?? []).filter((g) => genreIds.includes(g.id)).map((g) => g.name)
        router.push({
            pathname: '/swipe/[source]',
            params: {
                source,
                mediaType,
                ...(genreIds.length > 0
                    ? { genreIds: genreIds.join(','), genreName: selectedGenreNames.join(', ') }
                    : {}),
            },
        })
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <View className="mb-6 flex-row items-center gap-3 px-5">
                <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60">
                    <ChevronLeft size={26} color="#FFFFFF" />
                </Pressable>
                <Text className="flex-1 text-[20px] font-bold text-content-primary">Découvrir</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                <View className="mb-6 flex-row gap-3 px-5">
                    <Pressable
                        onPress={() => handleSelectSource('wishlist')}
                        className={`flex-1 items-center gap-2 rounded-2xl border p-5 active:opacity-70 ${
                            source === 'wishlist' ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                        }`}
                    >
                        <Heart
                            size={28}
                            color={source === 'wishlist' ? '#409CFF' : '#EBEBF599'}
                            fill={source === 'wishlist' ? '#409CFF' : 'transparent'}
                        />
                        <Text
                            className={`text-center text-[15px] font-semibold ${
                                source === 'wishlist' ? 'text-accent-light' : 'text-content-primary'
                            }`}
                        >
                            Liste de souhait
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => handleSelectSource('discover')}
                        className={`flex-1 items-center gap-2 rounded-2xl border p-5 active:opacity-70 ${
                            source === 'discover' ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                        }`}
                    >
                        <Sparkles size={28} color={source === 'discover' ? '#409CFF' : '#EBEBF599'} />
                        <Text
                            className={`text-center text-[15px] font-semibold ${
                                source === 'discover' ? 'text-accent-light' : 'text-content-primary'
                            }`}
                        >
                            Découverte
                        </Text>
                    </Pressable>
                </View>

                <View className="mb-6 flex-row gap-2 px-5">
                    {CATEGORY_TABS.map((tab) => {
                        const isActive = mediaType === tab.key
                        return (
                            <Pressable
                                key={tab.key}
                                onPress={() => handleSelectMediaType(tab.key)}
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

                {source === 'discover' ? (
                    <View className="mb-6 gap-2 px-5">
                        <Text className="text-[13px] font-semibold uppercase tracking-wide text-content-secondary">
                            Genres (optionnel, plusieurs possibles)
                        </Text>
                        {isGenresLoading ? (
                            <ActivityIndicator color="#409CFF" />
                        ) : (
                            <View className="flex-row flex-wrap gap-2">
                                <Pressable
                                    onPress={() => setGenreIds([])}
                                    className={`rounded-full border px-3 py-1.5 active:opacity-60 ${
                                        genreIds.length === 0 ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                                    }`}
                                >
                                    <Text
                                        className={`text-[13px] font-medium ${
                                            genreIds.length === 0 ? 'text-accent-light' : 'text-content-secondary'
                                        }`}
                                    >
                                        Tous les genres
                                    </Text>
                                </Pressable>
                                {(genres ?? []).map((genre) => {
                                    const isActive = genreIds.includes(genre.id)
                                    return (
                                        <Pressable
                                            key={genre.id}
                                            onPress={() => handleToggleGenre(genre.id)}
                                            className={`rounded-full border px-3 py-1.5 active:opacity-60 ${
                                                isActive ? 'border-accent-light bg-accent-light/20' : 'border-border-subtle bg-surface'
                                            }`}
                                        >
                                            <Text
                                                className={`text-[13px] font-medium ${
                                                    isActive ? 'text-accent-light' : 'text-content-secondary'
                                                }`}
                                            >
                                                {genre.name}
                                            </Text>
                                        </Pressable>
                                    )
                                })}
                            </View>
                        )}
                    </View>
                ) : null}

                <View className="px-5">
                    <Pressable
                        onPress={handleStart}
                        disabled={!source}
                        className="items-center rounded-2xl bg-accent px-4 py-3.5 active:opacity-70 disabled:opacity-40"
                    >
                        <Text className="text-[15px] font-semibold text-content-primary">C'est parti</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}
