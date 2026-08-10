import { Alert, Platform, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as AppleAuthentication from 'expo-apple-authentication'
import { signInWithApple } from '@/features/auth/api'

export default function LoginScreen() {
    async function handleAppleSignIn() {
        const { error } = await signInWithApple()
        if (error) Alert.alert('Erreur', 'Connexion avec Apple impossible, réessaie.')
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top', 'bottom' ]}>
            <View className="flex-1 justify-center gap-8 px-6">
                <View className="items-center gap-3">
                    <Image
                        source={require('../../../assets/icon.png')}
                        style={{ width: 140, height: 140 }}
                        contentFit="contain"
                    />
                    <Text className="text-[28px] font-bold text-content-primary">Krokmo'vie</Text>
                    <Text className="text-center text-[15px] text-content-secondary">
                        {'Votre bibliothèque de films et séries à deux.\nConnecte-toi pour retrouver votre liste.'}
                    </Text>
                </View>

                {Platform.OS === 'ios' ? (
                    <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                        cornerRadius={12}
                        style={{ height: 50 }}
                        onPress={handleAppleSignIn}
                    />
                ) : (
                    <Text className="text-center text-[14px] text-content-tertiary">
                        La connexion n'est disponible que sur iOS pour l'instant.
                    </Text>
                )}
            </View>
        </SafeAreaView>
    )
}
