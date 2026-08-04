import { useEffect } from 'react'
import { router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import type { MediaType } from '@/types/tmdb'

function handleResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as
        | { type?: string; tmdbId?: number; mediaType?: MediaType }
        | undefined
    if (!data?.type) return

    if (data.type === 'movie' && typeof data.tmdbId === 'number' && data.mediaType) {
        router.push({ pathname: '/movie/[id]', params: { id: String(data.tmdbId), mediaType: data.mediaType } })
    }
}

/** Routes to the relevant title's detail page when the user taps a push notification
 * (wishlist add, first viewing, or a rating invitation — see the DB triggers in
 * supabase/migrations/0009_push_notifications.sql). */
export function useNotificationResponseHandler() {
    useEffect(() => {
        const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse)
        return () => subscription.remove()
    }, [])
}
