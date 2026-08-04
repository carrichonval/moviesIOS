import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ChevronRight, History } from 'lucide-react-native'

export default function StatsScreen() {
    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <View className="flex-1 px-5 pt-3">
                <Text className="mb-6 text-[28px] font-bold text-content-primary">Statistiques</Text>

                <Pressable
                    onPress={() => router.push('/history')}
                    className="flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3.5 active:opacity-70"
                >
                    <History size={20} color="#409CFF" />
                    <Text className="flex-1 text-[15px] font-semibold text-content-primary">Mon historique</Text>
                    <ChevronRight size={18} color="#8E8E93" />
                </Pressable>
            </View>
        </SafeAreaView>
    )
}
