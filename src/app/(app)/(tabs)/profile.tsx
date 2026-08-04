import { useState } from 'react'
import { Alert, Pressable, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { Bell, LogOut } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { deleteAccount, signOut } from '@/features/auth/api'
import { updateEmail, updatePassword } from '@/features/profile/api'
import { useProfile, useUpdateUsername } from '@/features/profile/hooks'
import { useNotificationsPreference, useSetNotificationsPreference } from '@/features/notifications/hooks'
import { emailFieldSchema, passwordFieldSchema, usernameFieldSchema } from '@/features/profile/schemas'
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

function AccountSection() {
    const { session, isLoading: isAuthLoading } = useAuth()
    const { data: profile, isLoading: isProfileLoading } = useProfile()
    const { mutateAsync: saveUsername } = useUpdateUsername()
    const isLoading = isAuthLoading || isProfileLoading

    async function handleSaveUsername(value: string) {
        await saveUsername(value)
    }

    async function handleSaveEmail(value: string) {
        const { error } = await updateEmail(value)
        if (error) throw error
        Alert.alert(
            'Vérifie tes emails',
            'Clique sur le lien de confirmation envoyé à ton ancienne et ta nouvelle adresse pour valider le changement.',
        )
    }

    async function handleSavePassword(value: string) {
        const { error } = await updatePassword(value)
        if (error) throw error
        Alert.alert('Mot de passe mis à jour')
    }

    if (isLoading) {
        return (
            <SectionCard title="Compte">
                <SkeletonRow />
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
            />
            <EditableRow
                label="Email"
                displayValue={session?.user.email ?? '—'}
                editValue={session?.user.email ?? ''}
                placeholder="Email"
                keyboardType="email-address"
                autoComplete="email"
                validate={(value) => emailFieldSchema.safeParse(value).error?.issues[ 0 ]?.message}
                onSave={handleSaveEmail}
            />
            <EditableRow
                label="Mot de passe"
                displayValue="••••••••"
                editValue=""
                placeholder="Nouveau mot de passe"
                secureTextEntry
                autoComplete="password-new"
                validate={(value) => passwordFieldSchema.safeParse(value).error?.issues[ 0 ]?.message}
                onSave={handleSavePassword}
                isLast
            />
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
            <View className="flex-row items-center justify-between py-3">
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
        </SectionCard>
    )
}

export default function ProfileScreen() {
    const { session, isLoading: isAuthLoading } = useAuth()
    const { data: profile, isLoading: isProfileLoading } = useProfile()
    const isLoading = isAuthLoading || isProfileLoading
    const tabBarHeight = useBottomTabBarHeight()
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
                contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
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
