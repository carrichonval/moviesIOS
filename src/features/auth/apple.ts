import * as Crypto from 'expo-crypto'

// Apple's native sign-in wants the SHA256 hash of the nonce (replay protection on their side);
// Supabase's signInWithIdToken/linkIdentity want the raw nonce back to verify the identity
// token's own nonce claim matches. Same pair is reused by both the sign-in and the linking flow
// (src/features/auth/api.ts) — one helper, not duplicated per call site.
export async function createAppleNonce() {
    const rawNonce = Crypto.randomUUID()
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce)
    return { rawNonce, hashedNonce }
}
