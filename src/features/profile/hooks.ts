import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { getProfile, updateUsername } from './api'

export function useProfile() {
    const { session } = useAuth()
    const userId = session?.user.id

    return useQuery({
        queryKey: [ 'profile', userId ],
        queryFn: () => getProfile(userId as string),
        enabled: !!userId,
    })
}

export function useUpdateUsername() {
    const { session } = useAuth()
    const userId = session?.user.id
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (username: string) => updateUsername(userId as string, username),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ 'profile', userId ] }),
    })
}
