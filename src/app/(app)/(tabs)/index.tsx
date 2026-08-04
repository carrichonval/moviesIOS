import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/features/auth/AuthProvider'

// Placeholder library tab — replace with the movies collection screen.
export default function LibraryScreen() {
    const { session } = useAuth()

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <View className="flex-1 items-center justify-center gap-2 px-6">
                <Text className="text-[20px] font-bold text-content-primary">Bibliothèque</Text>
                <Text className="text-center text-[14px] text-content-secondary">
                    Connecté en tant que {session?.user.email}
                </Text>
            </View>
        </SafeAreaView>
    )
}
