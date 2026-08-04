import { Modal, Pressable, Text, View } from 'react-native'
import { Trash2 } from 'lucide-react-native'

interface ConfirmDeleteAccountModalProps {
    visible: boolean
    isDeleting: boolean
    onCancel: () => void
    onConfirm: () => void
}

export function ConfirmDeleteAccountModal({ visible, isDeleting, onCancel, onConfirm }: ConfirmDeleteAccountModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View className="flex-1 items-center justify-center bg-black/60 px-8">
                <View className="w-full items-center gap-4 rounded-3xl bg-surface-elevated p-6">
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-danger/15">
                        <Trash2 size={26} color="#FF453A" />
                    </View>
                    <Text className="text-center text-[18px] font-bold text-content-primary">
                        Supprimer le compte ?
                    </Text>
                    <Text className="text-center text-[14px] text-content-secondary">
                        Cette action est irréversible : ton compte et toutes tes données seront définitivement
                        supprimés.
                    </Text>

                    <View className="w-full gap-2 pt-2">
                        <Pressable
                            onPress={onConfirm}
                            disabled={isDeleting}
                            className="h-14 items-center justify-center rounded-2xl bg-danger active:opacity-70 disabled:opacity-50"
                        >
                            <Text className="text-[16px] font-semibold text-content-primary">
                                {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={onCancel}
                            disabled={isDeleting}
                            className="h-14 items-center justify-center rounded-2xl active:opacity-70"
                        >
                            <Text className="text-[16px] font-semibold text-content-secondary">Annuler</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    )
}
