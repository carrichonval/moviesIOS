// Proxies TMDB requests so the API token never reaches the client (client-embedded env vars
// ship inside the app bundle). Unlike IGDB, TMDB's token doesn't need a refresh flow — it's a
// static Read Access Token (v4, the long JWT-style one from TMDB dashboard > Settings > API),
// sent as a Bearer header on every request.
const TMDB_API_URL = 'https://api.themoviedb.org/3'
const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')

Deno.serve(async (req) => {
    try {
        if (!TMDB_API_KEY) {
            return Response.json({ error: 'TMDB_API_KEY is not configured on this function.' }, { status: 500 })
        }

        const body = await req.json()
        const path = body.path
        const params = body.params as Record<string, string | number> | undefined
        if (typeof path !== 'string') {
            return Response.json({ error: 'path is required' }, { status: 400 })
        }

        const url = new URL(`${TMDB_API_URL}${path}`)
        url.searchParams.set('language', 'fr-FR')
        for (const [ key, value ] of Object.entries(params ?? {})) {
            if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
        }

        const tmdbResponse = await fetch(url, {
            headers: {
                Authorization: `Bearer ${TMDB_API_KEY}`,
                'Content-Type': 'application/json',
            },
        })

        return new Response(await tmdbResponse.text(), {
            status: tmdbResponse.status,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('[tmdb function]', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 },
        )
    }
})
