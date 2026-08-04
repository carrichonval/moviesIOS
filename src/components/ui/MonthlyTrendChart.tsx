import { Text, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'
import Animated, { FadeIn } from 'react-native-reanimated'

interface MonthlyTrendChartProps {
    data: { label: string; count: number }[];
    width: number;
    height?: number;
}

const ACCENT = '#409CFF'
const SURFACE = '#1C1C1E'
const TOP_PADDING = 20
const BOTTOM_PADDING = 4

export function MonthlyTrendChart({ data, width, height = 120 }: MonthlyTrendChartProps) {
    const maxValue = Math.max(...data.map((d) => d.count), 1)
    const stepX = data.length > 1 ? width / (data.length - 1) : 0
    const plotHeight = height - TOP_PADDING - BOTTOM_PADDING

    const points = data.map((d, i) => ({
        x: i * stepX,
        y: TOP_PADDING + plotHeight - (d.count / maxValue) * plotHeight,
        count: d.count,
    }))

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

    return (
        <Animated.View entering={FadeIn.duration(400)}>
            <Svg width={width} height={height}>
                <Defs>
                    <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={ACCENT} stopOpacity={0.35} />
                        <Stop offset="1" stopColor={ACCENT} stopOpacity={0} />
                    </LinearGradient>
                </Defs>
                <Path d={areaPath} fill="url(#trendFill)" />
                <Path
                    d={linePath}
                    stroke={ACCENT}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {points.map((p, i) =>
                    p.count > 0 ? (
                        <SvgText
                            key={`label-${i}`}
                            x={p.x}
                            y={p.y - 8}
                            fontSize={11}
                            fontWeight="600"
                            fill="#FFFFFF"
                            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                        >
                            {p.count}
                        </SvgText>
                    ) : null,
                )}
                {points.map((p, i) => (
                    <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={4} fill={ACCENT} stroke={SURFACE} strokeWidth={2} />
                ))}
            </Svg>
            <View className="mt-2 flex-row justify-between">
                {data.map((d, i) => (
                    <Text
                        key={d.label + i}
                        className="text-[11px] text-content-tertiary"
                        style={{
                            width: stepX || width / data.length,
                            textAlign: i === 0 ? 'left' : i === data.length - 1 ? 'right' : 'center',
                        }}
                    >
                        {d.label}
                    </Text>
                ))}
            </View>
        </Animated.View>
    )
}
