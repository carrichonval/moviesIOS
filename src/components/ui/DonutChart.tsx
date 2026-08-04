import { Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, { FadeIn } from 'react-native-reanimated'

export interface DonutSegment {
    label: string;
    value: number;
    color: string;
}

interface DonutChartProps {
    data: DonutSegment[];
    size?: number;
    strokeWidth?: number;
    /** Small muted line under the center total, e.g. "total". */
    centerCaption?: string;
}

const TRACK_COLOR = '#2C2C2E'

// Ring segments via `strokeDasharray`/`strokeDashoffset` on stacked circles — no arc-path
// trig needed, each segment is just "this much of the circumference, offset by however
// much came before it". `rotation={-90}` starts the first segment at 12 o'clock instead
// of the default 3 o'clock.
export function DonutChart({ data, size = 180, strokeWidth = 26, centerCaption = 'total' }: DonutChartProps) {
    const total = data.reduce((sum, segment) => sum + segment.value, 0)
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    let cumulative = 0

    return (
        <View className="items-center">
            <Animated.View entering={FadeIn.duration(400)} style={{ width: size, height: size }}>
                <Svg width={size} height={size}>
                    <Circle cx={size / 2} cy={size / 2} r={radius} stroke={TRACK_COLOR} strokeWidth={strokeWidth} fill="none" />
                    {total > 0
                        ? data
                            .filter((segment) => segment.value > 0)
                            .map((segment) => {
                                const segmentLength = (segment.value / total) * circumference
                                const dashOffset = -cumulative
                                cumulative += segmentLength
                                return (
                                    <Circle
                                        key={segment.label}
                                        cx={size / 2}
                                        cy={size / 2}
                                        r={radius}
                                        stroke={segment.color}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                                        strokeDashoffset={dashOffset}
                                        fill="none"
                                        rotation={-90}
                                        originX={size / 2}
                                        originY={size / 2}
                                    />
                                )
                            })
                        : null}
                </Svg>
                <View className="absolute inset-0 items-center justify-center">
                    <Text className="text-[26px] font-bold text-content-primary">{total}</Text>
                    <Text className="text-[12px] text-content-tertiary">{centerCaption}</Text>
                </View>
            </Animated.View>

            <View className="mt-4 flex-row flex-wrap justify-center gap-x-4 gap-y-2">
                {data.map((segment) => (
                    <View key={segment.label} className="flex-row items-center gap-1.5">
                        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                        <Text className="text-[12px] text-content-secondary">
                            {segment.label} ({segment.value})
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    )
}
