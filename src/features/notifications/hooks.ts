import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { registerPushToken, resetBadgeCount, unregisterPushToken } from './api'
import { getNotificationPermissionStatus, requestNotificationPermission } from './permissions'
import { getNotificationsEnabledPreference, setNotificationsEnabledPreference } from './preference'

const NOTIFICATIONS_ENABLED_QUERY_KEY = [ 'notifications-enabled' ]

export function useNotificationsPreference() {
    return useQuery({
        queryKey: NOTIFICATIONS_ENABLED_QUERY_KEY,
        queryFn: getNotificationsEnabledPreference,
    })
}

// Requests OS permission (and registers the push token) only when turning notifications
// on — turning them off never needs a permission prompt, just unregisters this device's
// token so triggers stop reaching it.
export function useSetNotificationsPreference() {
    const { session } = useAuth()
    const userId = session?.user.id
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (enabled: boolean) => {
            if (!enabled) {
                await unregisterPushToken()
                return setNotificationsEnabledPreference(false)
            }

            const granted = await requestNotificationPermission()
            if (granted && userId) await registerPushToken(userId)
            return setNotificationsEnabledPreference(granted)
        },
        onSuccess: (enabled) => queryClient.setQueryData(NOTIFICATIONS_ENABLED_QUERY_KEY, enabled),
    })
}

const NOTIFICATION_PERMISSION_STATUS_QUERY_KEY = [ 'notification-permission-status' ]

export function useNotificationPermissionStatus() {
    return useQuery({
        queryKey: NOTIFICATION_PERMISSION_STATUS_QUERY_KEY,
        queryFn: getNotificationPermissionStatus,
    })
}

// The OS permission dialog only ever shows once per install while the status is
// "undetermined" — asking again after that just silently returns the existing
// grant/denial, so there's no annoying re-prompt risk in firing this on every launch.
// Mirrors the outcome into the app's own on/off preference and registers the push token
// on grant, so the Profile switch and the actual subscription are in sync without the
// user having to separately opt in there.
export function useRequestNotificationPermissionOnLaunch() {
    const { session } = useAuth()
    const userId = session?.user.id
    const { data: status } = useNotificationPermissionStatus()
    const queryClient = useQueryClient()
    const hasRequestedRef = useRef(false)

    useEffect(() => {
        if (!userId || status !== 'undetermined' || hasRequestedRef.current) return
        hasRequestedRef.current = true

        async function run() {
            const granted = await requestNotificationPermission()
            if (granted) await registerPushToken(userId as string)
            await setNotificationsEnabledPreference(granted)
            queryClient.setQueryData(NOTIFICATIONS_ENABLED_QUERY_KEY, granted)
            queryClient.invalidateQueries({ queryKey: NOTIFICATION_PERMISSION_STATUS_QUERY_KEY })
        }

        run()
    }, [ userId, status, queryClient ])
}

// Opening the app counts as "caught up" — clears the OS badge immediately and zeroes this
// device's server-side counter (see resetBadgeCount) so the next push starts counting from
// 0 rather than continuing on top of whatever was already shown.
export function useClearBadgeOnLaunch() {
    const { session } = useAuth()
    const userId = session?.user.id
    const hasRunRef = useRef(false)

    useEffect(() => {
        if (!userId || hasRunRef.current) return
        hasRunRef.current = true

        Notifications.setBadgeCountAsync(0)
        resetBadgeCount().catch(() => {})
    }, [ userId ])
}
