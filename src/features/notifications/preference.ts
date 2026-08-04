import AsyncStorage from '@react-native-async-storage/async-storage'

const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled'

export async function getNotificationsEnabledPreference(): Promise<boolean> {
    const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY)
    return value === 'true'
}

export async function setNotificationsEnabledPreference(enabled: boolean): Promise<boolean> {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled))
    return enabled
}
