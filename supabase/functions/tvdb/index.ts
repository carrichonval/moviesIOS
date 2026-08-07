// Proxies TheTVDB requests so the API key never reaches the client (client-embedded env vars
// ship inside the app bundle). Unlike TMDB, TheTVDB has no static bearer token — auth is a
// POST /login exchanging the API key for a JWT valid ~1 month. The token is cached in a
// module-level variable (survives across warm invocations of this function) so a normal
// request doesn't pay for a login round-trip; a fresh login only happens on cold start or once
// the cached token is close to expiring.
const TVDB_API_URL = 'https://api4.thetvdb.com/v4'
const TVDB_API_KEY = Deno.env.get('TVDB_API_KEY')

// Refreshed well before the real ~1 month expiry so a warm function never serves a token
// TheTVDB is about to reject.
const TOKEN_TTL_MS = 28 * 24 * 60 * 60 * 1000

let cachedToken: { token: string; expiresAt: number } | null = null

async function login(): Promise<string> {
    const response = await fetch(`${TVDB_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: TVDB_API_KEY }),
    })
    if (!response.ok) {
        throw new Error(`TheTVDB login failed: ${response.status} ${await response.text()}`)
    }
    const json = await response.json()
    const token = json?.data?.token
    if (typeof token !== 'string') {
        throw new Error('TheTVDB login response is missing data.token')
    }
    return token
}

async function getToken(): Promise<string> {
    const now = Date.now()
    if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token

    const token = await login()
    cachedToken = { token, expiresAt: now + TOKEN_TTL_MS }
    return token
}

function buildUrl(path: string, params: Record<string, string | number> | undefined): URL {
    const url = new URL(`${TVDB_API_URL}${path}`)
    for (const [ key, value ] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
    }
    return url
}

Deno.serve(async (req) => {
    try {
        if (!TVDB_API_KEY) {
            return Response.json({ error: 'TVDB_API_KEY is not configured on this function.' }, { status: 500 })
        }

        const body = await req.json()
        const path = body.path
        const params = body.params as Record<string, string | number> | undefined
        if (typeof path !== 'string') {
            return Response.json({ error: 'path is required' }, { status: 400 })
        }

        const url = buildUrl(path, params)
        const token = await getToken()
        let tvdbResponse = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

        // The cached token can be rejected earlier than our TTL estimate (e.g. revoked server
        // side) — retry once with a fresh login rather than failing every request until the
        // cache naturally expires.
        if (tvdbResponse.status === 401) {
            cachedToken = null
            const freshToken = await getToken()
            tvdbResponse = await fetch(url, { headers: { Authorization: `Bearer ${freshToken}` } })
        }

        return new Response(await tvdbResponse.text(), {
            status: tvdbResponse.status,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('[tvdb function]', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 },
        )
    }
})
