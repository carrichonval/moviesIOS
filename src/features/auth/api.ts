import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'

export function signInWithPassword(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password })
}

export function signUp(email: string, password: string) {
    return supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: Linking.createURL('auth/callback') },
    })
}

export function signOut() {
    return supabase.auth.signOut()
}

export async function deleteAccount() {
    const { error } = await supabase.rpc('delete_user')
    if (error) return { error }
    return supabase.auth.signOut()
}
