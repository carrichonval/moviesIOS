import * as AppleAuthentication from 'expo-apple-authentication'
import { supabase } from '@/lib/supabase'
import { getProfile, updateUsername } from '@/features/profile/api'
import { createAppleNonce } from './apple'

// Shared by signInWithApple and linkAppleIdentity below — same native credential, only what's
// done with the resulting token/nonce differs (sign in as a new session vs. link onto the
// current one). Returns null if the user dismissed Apple's native sheet, which isn't an error
// worth surfacing to either caller.
//
// `fullName` is only ever populated by Apple on the very first authorization of this
// app/Apple ID pair, ever — every authorization after that (sign-in or linking) gets null here,
// even across reinstalls. Revoking access (iPhone Settings > [name] > Mot de passe et sécurité >
// Applications utilisant Apple ID) is the only way to get it again for testing.
async function getAppleCredential() {
    const { rawNonce, hashedNonce } = await createAppleNonce()
    try {
        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
        })
        if (!credential.identityToken) return null
        const fullName = [ credential.fullName?.givenName, credential.fullName?.familyName ]
            .filter(Boolean)
            .join(' ')
        return { identityToken: credential.identityToken, rawNonce, fullName: fullName || null }
    } catch (error) {
        if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null
        throw error
    }
}

// Best-effort only — a failure here (network blip, etc.) shouldn't undo an otherwise successful
// sign-in/link, so errors are swallowed rather than surfaced to the caller. Sets the
// dashboard-facing "Display Name" (auth.users' user_metadata) unconditionally, and the app's
// own username only if the profile doesn't already have one — never overwrites a pseudo the
// user already picked.
async function applyAppleDisplayName(userId: string, fullName: string | null) {
    if (!fullName) return
    try {
        await supabase.auth.updateUser({ data: { full_name: fullName } })
        const profile = await getProfile(userId)
        if (!profile.username) await updateUsername(userId, fullName)
    } catch {
        // Non-critical enrichment — see comment above.
    }
}

// New session via Apple — the login screen's only entry point now. If this Apple identity is
// already linked (see linkAppleIdentity), Supabase resolves it back to that same existing user;
// if not, this creates a brand new auth.users/public.users row (Supabase's usual OAuth-first-
// sign-in behavior), which is why linking from Settings first matters for an account that
// predates Apple sign-in (still had a password at the time).
export async function signInWithApple() {
    const credential = await getAppleCredential()
    if (!credential) return { error: null }
    const result = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: credential.rawNonce,
    })
    if (result.data.user) await applyAppleDisplayName(result.data.user.id, credential.fullName)
    return result
}

// Attaches Apple to the CURRENTLY signed-in user (native ID token variant of linkIdentity, not
// the browser-redirect OAuth one) — decided with the user specifically to avoid a duplicate
// account: this never creates a new auth.users row, it only adds an identity to the existing
// session's user, regardless of what email Apple hands back (including a private relay email
// that wouldn't match the existing account for Supabase's automatic-linking-by-email).
export async function linkAppleIdentity() {
    const credential = await getAppleCredential()
    if (!credential) return { error: null }
    const result = await supabase.auth.linkIdentity({
        provider: 'apple',
        token: credential.identityToken,
        nonce: credential.rawNonce,
    })
    if (result.data?.user) await applyAppleDisplayName(result.data.user.id, credential.fullName)
    return result
}

export function signOut() {
    return supabase.auth.signOut()
}

export async function deleteAccount() {
    const { error } = await supabase.rpc('delete_user')
    if (error) return { error }
    return supabase.auth.signOut()
}
