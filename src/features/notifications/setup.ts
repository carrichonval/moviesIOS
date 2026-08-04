import * as Notifications from 'expo-notifications'

// Imported once for its side effect (see src/app/_layout.tsx) — without a handler, a push
// that arrives while the app is in the foreground is silently dropped instead of shown.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
})
