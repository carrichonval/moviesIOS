// `npx expo run:ios --device` (local dev) never sets this, so it defaults to 'development'
// — a different bundle identifier than the real app, so installing a dev build no longer
// overwrites the TestFlight one on the same phone; they show up side by side. Only
// `eas build --profile production` (see eas.json) sets APP_VARIANT=production, which keeps
// the exact bundle identifier already registered with App Store Connect (ascAppId
// 6797950214 in eas.json) — don't change that branch without checking there first.
const APP_VARIANT = process.env.APP_VARIANT ?? 'development'
const IS_PRODUCTION = APP_VARIANT === 'production'

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
    expo: {
        // Display name shown under the home screen icon.
        name: IS_PRODUCTION ? "Krokmo'vie" : "Krokmo'vie (Dev)",
        // URL-safe identifier used by Expo/EAS to identify this project. Usually kebab-case of name.
        slug: 'krokmovie',
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'dark',
        // Deep-link scheme (e.g. myapp://). Used for the Supabase email-confirmation callback via
        // Linking.createURL() in src/features/auth/api.ts and src/features/profile/api.ts — no
        // other file needs to change when you rename this. Suffixed for dev too, so a confirmation
        // email opened while both builds are installed doesn't risk landing in the wrong one.
        scheme: IS_PRODUCTION ? 'krokmovie' : 'krokmovie-dev',
        ios: {
            supportsTablet: true,
            // Reverse-DNS bundle identifier, must be unique per app (e.g. com.yourdomain.appname).
            bundleIdentifier: IS_PRODUCTION ? 'com.carrichonval.krokmovie' : 'com.carrichonval.krokmovie.dev',
            config: {
                usesNonExemptEncryption: false,
            },
        },
        android: {
            adaptiveIcon: {
                backgroundColor: '#E6F4FE',
                foregroundImage: './assets/android-icon-foreground.png',
                backgroundImage: './assets/android-icon-background.png',
                monochromeImage: './assets/android-icon-monochrome.png',
            },
            predictiveBackGestureEnabled: false,
            // Same identifier as ios.bundleIdentifier, Android convention (e.g. com.yourdomain.appname).
            package: IS_PRODUCTION ? 'com.carrichonval.krokmovie' : 'com.carrichonval.krokmovie.dev',
        },
        web: {
            favicon: './assets/favicon.png',
        },
        plugins: [
            'expo-router',
            'expo-secure-store',
            'expo-font',
            [ 'expo-notifications', { color: '#409CFF' } ],
        ],
        extra: {
            router: {},
            eas: {
                // Create with `eas init`, or paste the projectId from expo.dev/accounts/<you>/projects/<slug>.
                "projectId": "6c0218a6-5db0-4200-83e1-7d36ca72f84e",
            },
        },
        // Your Expo/EAS account or organization username.
        owner: 'liittlefoxx',
    },
}
