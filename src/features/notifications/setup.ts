import * as Notifications from 'expo-notifications'

// Imported once for its side effect (see src/app/_layout.tsx) — without a handler, a push
// that arrives while the app is in the foreground is silently dropped instead of shown.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        // The push payload carries its own `badge` value (see notify_push in
        // supabase/migrations/0012_push_badge_accumulation.sql) — this just lets the OS
        // apply it instead of ignoring it. Clearing the badge on launch/tap needs the
        // signed-in user (to reset the server-side counter too, see resetBadgeCount in
        // api.ts) — that happens in hooks.ts's useClearBadgeOnLaunch, not here.
        shouldSetBadge: true,
    }),
})
