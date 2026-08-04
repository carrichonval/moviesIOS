import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase'

// The `movies` schema isn't in src/types/database.ts — see the same cast in
// src/features/movies/api/library.ts.
const moviesDb = (supabase as any).schema('movies')

// Simulators/emulators can't receive real pushes, and `getExpoPushTokenAsync` throws
// without a real EAS project id configured (see app.config.js's `extra.eas.projectId`) —
// both are expected "nothing to register" cases here, not errors worth surfacing.
async function getExpoPushToken(): Promise<string | null> {
    if (!Device.isDevice) return null
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    if (!projectId || projectId === '__EAS_PROJECT_ID__') return null

    try {
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
        return data
    } catch {
        return null
    }
}

// A push token identifies this app install on this device, not a person — upserting on
// the token (not on user_id) means re-registering the same device just reassigns it
// (e.g. testing both accounts on one phone) instead of creating a duplicate row.
export async function registerPushToken(userId: string): Promise<void> {
    const token = await getExpoPushToken()
    if (!token) return

    const { error } = await moviesDb
        .from('push_tokens')
        .upsert({ user_id: userId, expo_push_token: token }, { onConflict: 'expo_push_token' })
    if (error) throw error
}

export async function unregisterPushToken(): Promise<void> {
    const token = await getExpoPushToken()
    if (!token) return

    const { error } = await moviesDb.from('push_tokens').delete().eq('expo_push_token', token)
    if (error) throw error
}
