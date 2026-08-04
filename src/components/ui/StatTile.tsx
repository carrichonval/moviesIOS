import { Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

interface StatTileProps {
    label: string;
    value: number;
    icon: LucideIcon;
    color: string;
    /** Small muted line under the label, e.g. a "34%" share of the library. */
    caption?: string;
}

export function StatTile({ label, value, icon: Icon, color, caption }: StatTileProps) {
    return (
        <View className="flex-1 items-center gap-1.5 rounded-2xl border border-border-subtle bg-surface py-4">
            <Icon size={18} color={color} />
            <Text className="text-[20px] font-bold text-content-primary">{value}</Text>
            <Text className="text-[11px] font-medium text-content-secondary" numberOfLines={1}>
                {label}
            </Text>
            {caption ? (
                <Text className="text-[10px] text-content-tertiary" numberOfLines={1}>
                    {caption}
                </Text>
            ) : null}
        </View>
    )
}
