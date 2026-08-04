import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as Linking from 'expo-linking'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'

function extractTokensFromUrl(url: string) {
    const fragment = url.split('#')[1] ?? url.split('?')[1] ?? ''
    const params = new URLSearchParams(fragment)
    return { accessToken: params.get('access_token'), refreshToken: params.get('refresh_token') }
}

interface AuthContextValue {
    session: Session | null
    isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [ session, setSession ] = useState<Session | null>(null)
    const [ isLoading, setIsLoading ] = useState(true)

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
            setIsLoading(false)
        })

        const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
            setSession(newSession)
            if (event === 'SIGNED_OUT') {
                queryClient.clear()
            }
        })

        return () => listener.subscription.unsubscribe()
    }, [])

    useEffect(() => {
        const handleUrl = ({ url }: { url: string }) => {
            const { accessToken, refreshToken } = extractTokensFromUrl(url)
            if (accessToken && refreshToken) {
                supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            }
        }

        Linking.getInitialURL().then((url) => {
            if (url) handleUrl({ url })
        })

        const subscription = Linking.addEventListener('url', handleUrl)
        return () => subscription.remove()
    }, [])

    return <AuthContext.Provider value={{ session, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within an AuthProvider')
    return context
}
