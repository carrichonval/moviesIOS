import { useEffect } from 'react'
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated'

interface SkeletonProps {
    width?: number | `${number}%`
    height?: number
    rounded?: number
}

/** Pulsing placeholder block, used to reserve the shape of content while it loads. */
export function Skeleton({ width = '100%', height = 14, rounded = 6 }: SkeletonProps) {
    const opacity = useSharedValue(0.4)

    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true)
        return () => cancelAnimation(opacity)
    }, [ opacity ])

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

    return (
        <Animated.View
            className="bg-surface-elevated"
            style={[ { width, height, borderRadius: rounded }, animatedStyle ]}
        />
    )
}
