import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'

interface BarRowProps {
    label: string;
    value: number;
    maxValue: number;
    /** Either a Tailwind background class (`bg-accent`) or a raw hex passed via
     * `color` — whichever fits the caller's palette source. */
    colorClassName?: string;
    color?: string;
    labelWidth?: number;
    delay?: number;
    /** When given, shows what share of this total `value` represents, e.g. "12 · 34%". */
    total?: number;
}

export function BarRow({ label, value, maxValue, colorClassName, color, labelWidth = 92, delay = 0, total }: BarRowProps) {
    const widthPercent = useSharedValue(0)

    useEffect(() => {
        const target = maxValue > 0 ? (value / maxValue) * 100 : 0
        widthPercent.value = withDelay(delay, withTiming(target, { duration: 500 }))
    }, [ value, maxValue, delay, widthPercent ])

    const animatedStyle = useAnimatedStyle(() => ({
        width: `${widthPercent.value}%`,
        ...(color ? { backgroundColor: color } : {}),
    }))
    const percentage = total && total > 0 ? Math.round((value / total) * 100) : null

    return (
        <View className="flex-row items-center gap-3">
            <Text
                className="text-[13px] font-medium text-content-secondary"
                numberOfLines={1}
                style={{ width: labelWidth }}
            >
                {label}
            </Text>
            <View className="h-2 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                <Animated.View className={`h-2 rounded-full ${colorClassName ?? ''}`} style={animatedStyle} />
            </View>
            <Text
                className="text-right text-[13px] font-semibold text-content-primary"
                style={{ width: percentage !== null ? 68 : 24 }}
            >
                {value}
                {percentage !== null ? (
                    <Text className="text-[11px] font-medium text-content-tertiary"> · {percentage}%</Text>
                ) : null}
            </Text>
        </View>
    )
}
