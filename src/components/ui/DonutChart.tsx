import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated'

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
// Visual gap between segments, in px of circumference — an Apple Fitness/Health ring
// doesn't butt segments edge to edge, it leaves a sliver of track showing between them.
const SEGMENT_GAP = 6
const SWEEP_DURATION = 900

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// One segment's arc. `start`/`length` are this segment's fixed position along the
// circumference (in px); `sweep` is a single shared value driving every segment at once —
// as it animates from 0 to the full circumference, each segment reveals its own slice the
// moment the sweep passes through it, exactly like a stopwatch hand painting the ring as it
// goes around, rather than every segment fading in independently.
function DonutSegmentArc({
    size,
    radius,
    strokeWidth,
    color,
    start,
    length,
    sweep,
}: {
    size: number;
    radius: number;
    strokeWidth: number;
    color: string;
    start: number;
    length: number;
    sweep: SharedValue<number>;
}) {
    const circumference = 2 * Math.PI * radius

    const animatedProps = useAnimatedProps(() => {
        const revealed = Math.min(Math.max(sweep.value - start, 0), length)
        return { strokeDasharray: `${revealed} ${circumference - revealed}` }
    })

    return (
        <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
            strokeDashoffset={-start}
            animatedProps={animatedProps}
        />
    )
}

// Ring segments via `strokeDasharray`/`strokeDashoffset` on stacked circles — no arc-path
// trig needed, each segment is just "this much of the circumference, offset by however
// much came before it". `rotation={-90}` starts the first segment at 12 o'clock instead
// of the default 3 o'clock. Rounded caps + inter-segment gaps + the sweep-reveal animation
// above are what give this the "current" Apple Fitness ring look instead of a flat static band.
export function DonutChart({ data, size = 180, strokeWidth = 26, centerCaption = 'total' }: DonutChartProps) {
    const total = data.reduce((sum, segment) => sum + segment.value, 0)
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const visibleSegments = data.filter((segment) => segment.value > 0)

    const sweep = useSharedValue(0)
    useEffect(() => {
        sweep.value = 0
        sweep.value = withTiming(circumference, { duration: SWEEP_DURATION, easing: Easing.out(Easing.cubic) })
        // Re-plays only when the total genuinely changes (not on every silent refetch that
        // happens to return the same numbers) — `total` is a plain number, not the array
        // reference react-query hands back each time.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ total ])

    let cumulative = 0
    const segments = visibleSegments.map((segment, index) => {
        const rawLength = (segment.value / total) * circumference
        // No gap trimmed off the last segment — a gap there would leave a stray notch
        // right where the first segment starts, instead of a clean seam.
        const isLast = index === visibleSegments.length - 1
        const length = Math.max(rawLength - (isLast ? 0 : SEGMENT_GAP), 0)
        const start = cumulative
        cumulative += rawLength
        return { ...segment, start, length }
    })

    return (
        <View className="items-center">
            <View style={{ width: size, height: size }}>
                <Svg width={size} height={size}>
                    <Circle cx={size / 2} cy={size / 2} r={radius} stroke={TRACK_COLOR} strokeWidth={strokeWidth} fill="none" />
                    {total > 0
                        ? segments.map((segment) => (
                            <DonutSegmentArc
                                key={segment.label}
                                size={size}
                                radius={radius}
                                strokeWidth={strokeWidth}
                                color={segment.color}
                                start={segment.start}
                                length={segment.length}
                                sweep={sweep}
                            />
                        ))
                        : null}
                </Svg>
                <View className="absolute inset-0 items-center justify-center">
                    <Text className="text-[26px] font-bold text-content-primary">{total}</Text>
                    <Text className="text-[12px] text-content-tertiary">{centerCaption}</Text>
                </View>
            </View>

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
