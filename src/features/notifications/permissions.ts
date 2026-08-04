import * as Notifications from 'expo-notifications'

export async function getNotificationPermissionStatus() {
    const { status } = await Notifications.getPermissionsAsync()
    return status
}

/** Returns whether permission ended up granted — the caller decides how to react (e.g. keep a toggle off). */
export async function requestNotificationPermission(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
}
