import { supabase } from '@/lib/supabase'

export async function getProfile(userId: string) {
    const { data, error } = await supabase.from('users').select('username').eq('id', userId).single()
    if (error) throw error
    return data
}

export async function updateUsername(userId: string, username: string) {
    const { error } = await supabase.from('users').update({ username }).eq('id', userId)
    if (error) throw error
}
