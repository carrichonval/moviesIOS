/** Derives up to 2 uppercase initials from a username or email ("carrichonval" -> "CA"). */
export function getInitials(value: string): string {
    const cleaned = (value.split('@')[ 0 ] ?? '').trim()
    if (!cleaned) return '?'

    const parts = cleaned.split(/[\s._-]+/).filter(Boolean)
    if (parts.length >= 2 && parts[ 0 ] && parts[ 1 ]) {
        return (parts[ 0 ].charAt(0) + parts[ 1 ].charAt(0)).toUpperCase()
    }

    return cleaned.slice(0, 2).toUpperCase()
}
