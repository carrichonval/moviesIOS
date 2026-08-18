import { forwardRef, useCallback } from 'react'
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet'
import { Image } from 'expo-image'
import { Check } from 'lucide-react-native'
import type { TmdbPosterOption } from '@/services/tmdb'

interface PosterPickerSheetProps {
    posters: TmdbPosterOption[];
    isLoading: boolean;
    /** The poster currently shown on the detail screen — highlighted in the grid so it's
     * clear which one is already applied, same idea as a "current selection" checkmark in
     * any picker. */
    selectedPosterUrl: string | null;
    onSelect: (poster: TmdbPosterOption) => void;
    onDismiss?: () => void;
}

// Same grid technique as FavoriteCharacterSheet/BrowseMovieCard (fixed columns, equal-width
// slots so a partial last row just leaves empty space instead of stretching) and the same
// 2:3 poster ratio as the cover grids — 3 columns rather than FavoriteCharacterSheet's 4
// since a real movie poster needs more width than a cropped headshot to stay legible.
const GRID_COLUMNS = 3
const GRID_HORIZONTAL_PADDING = 20
const GRID_GAP = 12
const CARD_RADIUS = 12
const CARD_ASPECT_RATIO = 3 / 2
const MAX_HEIGHT_RATIO = 0.6

// Same @gorhom/bottom-sheet setup as Runway's sheets (DayOccurrencesSheet etc., see that
// file) — a real native drag-to-dismiss sheet, presented imperatively via ref
// (`.present()`/`.dismiss()`) rather than a `visible` prop like the older RN-Modal-based
// FavoriteCharacterSheet. `enableDynamicSizing` + `maxDynamicContentSize` (not `snapPoints`
// — the two don't mix, gorhom keeps re-measuring against both and the sheet visibly
// jitters/grows mid-scroll) is the supported way to say "size to content, but never past
// 60% of the screen" — past that cap the grid scrolls inside via BottomSheetScrollView
// instead of the sheet itself growing. `backgroundStyle` is a literal near-black hex (gorhom
// needs a real value, not a NativeWind className) — darker than `surface-elevated`, which
// reads as too light against a poster.
export const PosterPickerSheet = forwardRef<BottomSheetModal, PosterPickerSheetProps>(function PosterPickerSheet(
    { posters, isLoading, selectedPosterUrl, onSelect, onDismiss },
    ref,
) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions()
    // Floored, not exact division — flex-wrap rounds each card's width to the nearest
    // device pixel independently, so 3 cards at the exact float width can sum a hair wider
    // than the row and bump the 3rd one to a new line. Flooring leaves enough slack that
    // never happens (this is what dropped the grid to 2 columns before).
    const cardWidth = Math.floor((windowWidth - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS)
    const cardHeight = Math.round(cardWidth * CARD_ASPECT_RATIO)
    const maxSheetHeight = Math.round(windowHeight * MAX_HEIGHT_RATIO)

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
        ),
        [],
    )

    return (
        <BottomSheetModal
            ref={ref}
            enableDynamicSizing
            maxDynamicContentSize={maxSheetHeight}
            backdropComponent={renderBackdrop}
            onDismiss={onDismiss}
            backgroundStyle={{ backgroundColor: '#151517' }}
            handleIndicatorStyle={{ backgroundColor: '#3A3A3C' }}
        >
            <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: GRID_HORIZONTAL_PADDING, paddingBottom: 32 }}>
                <Text className="mb-4 text-[17px] font-bold text-content-primary">Choisir une affiche</Text>

                {isLoading ? (
                    <View className="items-center justify-center py-12">
                        <ActivityIndicator color="#409CFF" />
                    </View>
                ) : posters.length === 0 ? (
                    <Text className="py-8 text-center text-[14px] text-content-tertiary">
                        Aucune autre affiche trouvée pour ce titre.
                    </Text>
                ) : (
                    <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
                        {posters.map((poster) => {
                            const isSelected = poster.posterUrl === selectedPosterUrl
                            return (
                                <Pressable
                                    key={poster.filePath}
                                    onPress={() => onSelect(poster)}
                                    className={`overflow-hidden bg-surface active:opacity-70 ${
                                        isSelected ? 'border-2 border-accent-light' : ''
                                    }`}
                                    style={{ width: cardWidth, height: cardHeight, borderRadius: CARD_RADIUS }}
                                >
                                    <Image
                                        source={{ uri: poster.posterUrl }}
                                        style={{ width: cardWidth, height: cardHeight }}
                                        contentFit="cover"
                                        transition={200}
                                    />
                                    {isSelected ? (
                                        <View className="absolute right-1.5 top-1.5 h-5 w-5 items-center justify-center rounded-full bg-accent-light">
                                            <Check size={12} color="#FFFFFF" />
                                        </View>
                                    ) : null}
                                </Pressable>
                            )
                        })}
                    </View>
                )}
            </BottomSheetScrollView>
        </BottomSheetModal>
    )
})
