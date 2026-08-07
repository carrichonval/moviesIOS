import { Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import type { TitleCastMember } from '@/types/tmdb'

interface FavoriteCharacterSheetProps {
    visible: boolean;
    cast: TitleCastMember[];
    onSelect: (character: TitleCastMember) => void;
    onClose: () => void;
}

// Fixed columns, same technique as the cover grids (index.tsx/search.tsx/watch-providers.tsx)
// — every row gets the same number of equal-width slots, so a partial last row just leaves
// empty space instead of one big gap on the right (plain flex-wrap with no fixed slot width,
// which is what circular photos with no shared grid used to do here).
const GRID_COLUMNS = 4
const GRID_HORIZONTAL_PADDING = 20
const GRID_GAP = 12
// Exported so the detail screen's own "Persos préféré" preview cards (movie/[id].tsx) can
// match this sheet's card size exactly rather than duplicating the computation.
export const CARD_WIDTH =
    (Dimensions.get('window').width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS
export const CARD_RADIUS = 12
// Same 2:3 poster ratio as the cover cards (BrowseMovieCard's COVER_ASPECT_RATIO) — TheTVDB's
// character artwork is portrait-oriented too, so this crops much less than a square/circle did.
const CARD_ASPECT_RATIO = 3 / 2
export const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT_RATIO

// Same "RN Modal + transparent + scrim + rounded surface card" technique as
// ConfirmDeleteAccountModal (src/features/profile/components/) — no bottom-sheet library
// installed anywhere in this codebase, `animationType="slide"` + a bottom-anchored,
// rounded-top card is RN's own slide-up transition, nothing extra needed. The inner
// Pressable with a no-op onPress exists only to stop taps on the sheet's own whitespace
// (title, padding) from falling through to the outer scrim's dismiss handler — taps on an
// actual cast item are already claimed by that item's own Pressable regardless.
export function FavoriteCharacterSheet({ visible, cast, onSelect, onClose }: FavoriteCharacterSheetProps) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
                <Pressable onPress={() => {}} className="max-h-[75%] rounded-t-3xl bg-surface-elevated pt-3">
                    <View className="mb-3 h-1 w-10 self-center rounded-full bg-border-subtle" />
                    <Text className="mb-4 px-5 text-[17px] font-bold text-content-primary">Personnage préféré</Text>

                    <ScrollView
                        contentContainerStyle={{ paddingHorizontal: GRID_HORIZONTAL_PADDING, paddingBottom: 32 }}
                    >
                        {cast.length === 0 ? (
                            <Text className="py-8 text-center text-[14px] text-content-tertiary">
                                Aucun personnage trouvé pour ce titre.
                            </Text>
                        ) : (
                            <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
                                {cast.map((member) => (
                                    <Pressable
                                        key={member.personId}
                                        onPress={() => onSelect(member)}
                                        className="gap-1.5 active:opacity-70"
                                        style={{ width: CARD_WIDTH }}
                                    >
                                        <View
                                            className="overflow-hidden bg-surface"
                                            style={{ width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: CARD_RADIUS }}
                                        >
                                            <Image
                                                source={{ uri: member.profilePhotoUrl ?? undefined }}
                                                style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
                                                contentFit="cover"
                                                transition={200}
                                            />
                                        </View>
                                        <Text
                                            numberOfLines={1}
                                            className="text-center text-[12px] font-semibold text-content-primary"
                                        >
                                            {member.character}
                                        </Text>
                                        <Text numberOfLines={1} className="text-center text-[11px] text-content-tertiary">
                                            {member.name}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    )
}
