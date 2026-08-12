import { useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, Switch, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { Bell, Check, ChevronRight, LogOut, Tv } from 'lucide-react-native'
import Svg, { Path } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { deleteAccount, linkAppleIdentity, signOut } from '@/features/auth/api'
import { useProfile, useUpdateUsername } from '@/features/profile/hooks'
import { useNotificationsPreference, useSetNotificationsPreference } from '@/features/notifications/hooks'
import { usernameFieldSchema } from '@/features/profile/schemas'
import { EditableRow } from '@/features/profile/components/EditableRow'
import { ConfirmDeleteAccountModal } from '@/features/profile/components/ConfirmDeleteAccountModal'
import { Skeleton } from '@/components/ui/Skeleton'
import { getInitials } from '@/utils/text'

const memberSinceFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View className="gap-1 rounded-2xl border border-border-subtle bg-surface p-4">
            <Text className="pb-1 text-[13px] font-semibold uppercase tracking-wide text-content-secondary">
                {title}
            </Text>
            {children}
        </View>
    )
}

function SkeletonRow({ isLast }: { isLast?: boolean }) {
    return (
        <View className={isLast ? 'gap-1.5 py-3' : 'gap-1.5 border-b border-border-subtle py-3'}>
            <View className="flex-row items-center gap-3">
                <View className="flex-1 gap-1.5">
                    <Skeleton width={80} height={11} rounded={4} />
                    <Skeleton width={140} height={17} rounded={4} />
                </View>
                <Skeleton width={18} height={18} rounded={9} />
            </View>
        </View>
    )
}

// Hand-drawn Apple logo (Font Awesome's "apple" brand glyph path, MIT-licensed) — the
// U+F8FF private-use codepoint trick doesn't work here since this app loads a custom font that
// doesn't include Apple's own glyph there, so an actual SVG shape is the reliable option
// without pulling in a native icon module (react-native-svg is already a dependency of
// lucide-react-native, no rebuild needed).
function AppleLogo({ size = 18 }: { size?: number }) {
    return (
        <Svg width={size} height={(size * 512) / 384} viewBox="0 0 384 512">
            <Path
                fill="#FFFFFF"
                d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
            />
        </Svg>
    )
}

// Apple sign-in is iOS-only (see login.tsx's own Platform.OS guard on the button) — this row
// just mirrors that, no linking action makes sense where the native module isn't present.
function AppleLinkRow() {
    const { session } = useAuth()
    const [ isLinking, setIsLinking ] = useState(false)
    const isLinked = session?.user.identities?.some((identity) => identity.provider === 'apple') ?? false

    async function handleLink() {
        setIsLinking(true)
        const { error } = await linkAppleIdentity()
        // linkIdentity mutates the identity server-side but doesn't push the change through
        // AuthProvider's onAuthStateChange on its own — refreshSession() does, which is what
        // makes `isLinked` above flip without the user having to log out and back in.
        if (!error) await supabase.auth.refreshSession()
        setIsLinking(false)
        if (error) Alert.alert('Erreur', 'Impossible de lier le compte Apple, réessaie.')
    }

    if (Platform.OS !== 'ios') return null

    return (
        <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-black">
                    <AppleLogo size={16} />
                </View>
                <View>
                    <Text className="text-[15px] font-semibold text-content-primary">Compte Apple</Text>
                    <Text className="text-[13px] text-content-secondary">{isLinked ? 'Lié' : 'Non lié'}</Text>
                </View>
            </View>

            {isLinked ? (
                // Same green as the app's other "done/confirmed" checkmarks (tailwind's `success`).
                <Check size={20} color="#30D158" />
            ) : isLinking ? (
                <ActivityIndicator color="#409CFF" />
            ) : (
                <Pressable
                    onPress={handleLink}
                    className="rounded-full bg-accent px-3.5 py-1.5 active:opacity-70"
                >
                    <Text className="text-[13px] font-semibold text-content-primary">Lier</Text>
                </Pressable>
            )}
        </View>
    )
}

function AccountSection() {
    const { isLoading: isAuthLoading } = useAuth()
    const { data: profile, isLoading: isProfileLoading } = useProfile()
    const { mutateAsync: saveUsername } = useUpdateUsername()
    const isLoading = isAuthLoading || isProfileLoading

    async function handleSaveUsername(value: string) {
        await saveUsername(value)
    }

    if (isLoading) {
        return (
            <SectionCard title="Compte">
                <SkeletonRow />
                <SkeletonRow isLast />
            </SectionCard>
        )
    }

    return (
        <SectionCard title="Compte">
            <EditableRow
                label="Nom d'utilisateur"
                displayValue={profile?.username ?? '—'}
                editValue={profile?.username ?? ''}
                placeholder="Nom d'utilisateur"
                validate={(value) => usernameFieldSchema.safeParse(value).error?.issues[ 0 ]?.message}
                onSave={handleSaveUsername}
                isLast={Platform.OS !== 'ios'}
            />
            <AppleLinkRow />
        </SectionCard>
    )
}

function PreferencesSection() {
    const { data: isNotificationsEnabled, isLoading } = useNotificationsPreference()
    const { mutateAsync: setNotificationsEnabled, isPending } = useSetNotificationsPreference()

    async function handleToggleNotifications(next: boolean) {
        const granted = await setNotificationsEnabled(next)
        if (next && !granted) {
            Alert.alert(
                'Notifications désactivées',
                "Autorise les notifications pour Krokmo'vie dans les réglages de ton téléphone pour être prévenu des ajouts et notes de l'autre.",
            )
        }
    }

    return (
        <SectionCard title="Préférences">
            <View className="flex-row items-center justify-between border-b border-border-subtle py-3">
                <View className="flex-row items-center gap-3">
                    <Bell size={20} color="#8E8E93" />
                    <Text className="text-[15px] font-medium text-content-primary">Notifications</Text>
                </View>
                <Switch
                    value={!!isNotificationsEnabled}
                    onValueChange={handleToggleNotifications}
                    disabled={isLoading || isPending}
                    trackColor={{ true: '#409CFF', false: '#3A3A3C' }}
                />
            </View>

            <Pressable
                onPress={() => router.push('/watch-providers')}
                className="flex-row items-center justify-between py-3 active:opacity-60"
            >
                <View className="flex-row items-center gap-3">
                    <Tv size={20} color="#8E8E93" />
                    <Text className="text-[15px] font-medium text-content-primary">Plateformes favorites</Text>
                </View>
                <ChevronRight size={18} color="#8E8E93" />
            </Pressable>
        </SectionCard>
    )
}

export default function ProfileScreen() {
    const { session, isLoading: isAuthLoading } = useAuth()
    const { data: profile, isLoading: isProfileLoading } = useProfile()
    const isLoading = isAuthLoading || isProfileLoading
    const insets = useSafeAreaInsets()
    const [ isDeleting, setIsDeleting ] = useState(false)
    const [ isDeleteModalVisible, setIsDeleteModalVisible ] = useState(false)

    async function handleSignOut() {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        const { error } = await signOut()
        if (error) {
            Alert.alert('Erreur', 'Impossible de se déconnecter, réessaie.')
            return
        }
        // `Stack.Protected` in app/_layout.tsx reacts to the session becoming null and should
        // redirect on its own, but that redirect can silently not happen when the current
        // screen is deep in nested tab history (this is where "Se déconnecter" lives) — an
        // explicit `replace` here doesn't depend on that reactive guard actually firing.
        router.replace('/login')
    }

    async function handleConfirmDelete() {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        setIsDeleting(true)
        const { error } = await deleteAccount()
        setIsDeleting(false)
        if (error) {
            Alert.alert('Erreur', 'Impossible de supprimer le compte, réessaie plus tard.')
            return
        }
        setIsDeleteModalVisible(false)
        router.replace('/login')
    }

    const memberSince = session?.user.created_at
        ? memberSinceFormatter.format(new Date(session.user.created_at))
        : null
    const displayName = profile?.username || session?.user.email || ''

    return (
        <SafeAreaView className="flex-1 bg-background" edges={[ 'top' ]}>
            <KeyboardAwareScrollView
                contentContainerClassName="gap-4 px-6 pt-6"
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                keyboardShouldPersistTaps="handled"
                bottomOffset={20}
            >
                <View className="items-center gap-2 pb-2">
                    {isLoading ? (
                        <>
                            <Skeleton width={64} height={64} rounded={32} />
                            <Skeleton width={160} height={18} rounded={4} />
                            <Skeleton width={120} height={13} rounded={4} />
                        </>
                    ) : (
                        <>
                            <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-elevated">
                                <Text className="text-[20px] font-bold text-accent-light">{getInitials(displayName)}</Text>
                            </View>
                            <Text className="text-[18px] font-semibold text-content-primary">
                                {profile?.username ? `@${profile.username}` : session?.user.email}
                            </Text>
                            {memberSince ? (
                                <Text className="text-[13px] text-content-secondary">Membre depuis {memberSince}</Text>
                            ) : null}
                        </>
                    )}
                </View>

                <AccountSection />
                <PreferencesSection />

                <Pressable
                    onPress={handleSignOut}
                    className="h-14 flex-row items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface active:opacity-70"
                >
                    <LogOut size={18} color="#8E8E93" />
                    <Text className="text-[16px] font-semibold text-content-secondary">Se déconnecter</Text>
                </Pressable>

                <Pressable onPress={() => setIsDeleteModalVisible(true)} className="items-center py-2">
                    <Text className="text-[14px] font-medium text-danger">Supprimer mon compte</Text>
                </Pressable>

                <Text className="pb-2 pt-2 text-center text-[12px] text-content-tertiary">
                    Krokmo&apos;vie {Constants.expoConfig?.version ?? '—'}
                </Text>
            </KeyboardAwareScrollView>

            <ConfirmDeleteAccountModal
                visible={isDeleteModalVisible}
                isDeleting={isDeleting}
                onCancel={() => setIsDeleteModalVisible(false)}
                onConfirm={handleConfirmDelete}
            />
        </SafeAreaView>
    )
}
