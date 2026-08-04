import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/features/auth/AuthProvider'

export default function AuthCallbackScreen() {
    const { session } = useAuth()

    useEffect(() => {
        if (session) {
            router.replace('/(app)/(tabs)')
            return
        }

        const timeout = setTimeout(() => router.replace('/(auth)/login'), 5000)
        return () => clearTimeout(timeout)
    }, [ session ])

    return (
        <View className="flex-1 items-center justify-center bg-background">
            <ActivityIndicator color="#409CFF" />
        </View>
    )
}
