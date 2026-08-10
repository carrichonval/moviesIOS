import { useEffect, useRef } from 'react'
import { Animated, Keyboard, Platform, Pressable, Text, View, type KeyboardEvent } from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as AppleAuthentication from 'expo-apple-authentication'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas'
import { signInWithApple, signInWithPassword } from '@/features/auth/api'
import { AuthTextField } from '@/features/auth/components/AuthTextField'

// iOS fires a spurious keyboard hide+show pair when focus moves directly between
// the email and password fields (Keychain/Face ID credential lookup for the
// password field). Reacting to every event causes a visible dip; debouncing the
// "hide" lets an immediately-following "show" cancel it so the view stays put.
function useStableKeyboardPadding() {
    const padding = useRef(new Animated.Value(0)).current
    const currentHeight = useRef(0)
    const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const showEventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
        const hideEventName = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

        const handleShow = (event: KeyboardEvent) => {
            if (hideTimeout.current) {
                clearTimeout(hideTimeout.current)
                hideTimeout.current = null
            }
            const nextHeight = event.endCoordinates.height
            if (nextHeight === currentHeight.current) return
            currentHeight.current = nextHeight
            Animated.timing(padding, {
                toValue: nextHeight,
                duration: event.duration || 250,
                useNativeDriver: false,
            }).start()
        }

        const handleHide = () => {
            hideTimeout.current = setTimeout(() => {
                currentHeight.current = 0
                Animated.timing(padding, { toValue: 0, duration: 200, useNativeDriver: false }).start()
            }, 150)
        }

        const showSubscription = Keyboard.addListener(showEventName, handleShow)
        const hideSubscription = Keyboard.addListener(hideEventName, handleHide)

        return () => {
            showSubscription.remove()
            hideSubscription.remove()
            if (hideTimeout.current) clearTimeout(hideTimeout.current)
        }
    }, [ padding ])

    return padding
}

export default function LoginScreen() {
    const keyboardPadding = useStableKeyboardPadding()
    const {
        control,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    })

    async function onSubmit(values: LoginFormValues) {
        const { error } = await signInWithPassword(values.email, values.password)
        if (error) setError('root', { message: 'Email ou mot de passe incorrect' })
    }

    async function handleAppleSignIn() {
        const { error } = await signInWithApple()
        if (error) setError('root', { message: 'Connexion avec Apple impossible, réessaie.' })
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top', 'bottom' ]}>
            <Animated.View
                className="flex-1 justify-center gap-6 px-6"
                style={{ paddingBottom: keyboardPadding }}
            >
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

                <View className="gap-3">
                    <AuthTextField
                        control={control}
                        name="email"
                        placeholder="Email"
                        keyboardType="email-address"
                        autoComplete="email"
                    />
                    <AuthTextField
                        control={control}
                        name="password"
                        placeholder="Mot de passe"
                        secureTextEntry
                        autoComplete="password"
                    />

                    {errors.root ? (
                        <Text className="text-center text-[13px] text-danger">{errors.root.message}</Text>
                    ) : null}

                    <Pressable
                        onPress={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                        className="h-14 items-center justify-center rounded-2xl bg-accent active:opacity-70 disabled:opacity-50"
                    >
                        <Text className="text-[16px] font-semibold text-content-primary">
                            {isSubmitting ? 'Connexion...' : 'Me connecter'}
                        </Text>
                    </Pressable>
                    <Link href="/(auth)/register" asChild>
                        <Text className="text-center text-[14px] font-medium text-accent-light">
                            Pas de compte ? Créer un compte
                        </Text>
                    </Link>

                    {Platform.OS === 'ios' ? (
                        <>
                            <View className="flex-row items-center gap-3 pt-1">
                                <View className="h-px flex-1 bg-border-subtle" />
                                <Text className="text-[13px] text-content-tertiary">ou</Text>
                                <View className="h-px flex-1 bg-border-subtle" />
                            </View>
                            <AppleAuthentication.AppleAuthenticationButton
                                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                                cornerRadius={12}
                                style={{ height: 46 }}
                                onPress={handleAppleSignIn}
                            />
                        </>
                    ) : null}
                </View>
            </Animated.View>
        </SafeAreaView>
    )
}
