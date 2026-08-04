/** @type {import('expo/config').ExpoConfig} */
module.exports = {
    expo: {
        // Display name shown under the home screen icon.
        name: "Krokmo'vie",
        // URL-safe identifier used by Expo/EAS to identify this project. Usually kebab-case of name.
        slug: 'krokmovie',
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'dark',
        // Deep-link scheme (e.g. myapp://). Used for the Supabase email-confirmation callback via
        // Linking.createURL() in src/features/auth/api.ts and src/features/profile/api.ts — no
        // other file needs to change when you rename this.
        scheme: 'krokmovie',
        ios: {
            supportsTablet: true,
            // Reverse-DNS bundle identifier, must be unique per app (e.g. com.yourdomain.appname).
            bundleIdentifier: 'com.carrichonval.krokmovie',
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
            package: 'com.carrichonval.krokmovie',
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
