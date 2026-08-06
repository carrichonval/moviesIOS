import { useEffect, useMemo } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const PARTICLE_COUNT = 140
const COLORS = [ '#409CFF', '#30D158', '#FFD60A', '#FF453A', '#BF5AF2', '#FF9F0A' ]
const DURATION = 2000

interface ParticleConfig {
    id: number;
    color: string;
    startX: number;
    driftX: number;
    fallY: number;
    rotation: number;
    width: number;
    height: number;
    delay: number;
}

function buildParticles(): ParticleConfig[] {
    return Array.from({ length: PARTICLE_COUNT }, (_, id) => ({
        id,
        color: COLORS[ Math.floor(Math.random() * COLORS.length) ] as string,
        startX: Math.random() * SCREEN_WIDTH,
        driftX: (Math.random() - 0.5) * 120,
        fallY: SCREEN_HEIGHT * (0.55 + Math.random() * 0.45),
        rotation: (Math.random() - 0.5) * 900,
        width: 6 + Math.random() * 5,
        height: 10 + Math.random() * 6,
        delay: Math.random() * 200,
    }))
}

function Particle({ config }: { config: ParticleConfig }) {
    const progress = useSharedValue(0)

    useEffect(() => {
        progress.value = withDelay(config.delay, withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) }))
    }, [ config.delay, progress ])

    const style = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [ 0, 0.15, 0.85, 1 ], [ 0, 1, 1, 0 ]),
        transform: [
            { translateX: interpolate(progress.value, [ 0, 1 ], [ 0, config.driftX ]) },
            { translateY: interpolate(progress.value, [ 0, 1 ], [ 0, config.fallY ]) },
            { rotate: `${interpolate(progress.value, [ 0, 1 ], [ 0, config.rotation ])}deg` },
        ],
    }))

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    position: 'absolute',
                    left: config.startX,
                    top: -20,
                    width: config.width,
                    height: config.height,
                    borderRadius: 2,
                    backgroundColor: config.color,
                },
                style,
            ]}
        />
    )
}

interface ConfettiBurstProps {
    /** Fires once the fall/fade animation finishes — the caller unmounts this component
     * from there (see e.g. src/app/(app)/season/[id].tsx), it doesn't unmount itself. */
    onComplete: () => void;
}

// Plain colored rectangles falling from the top with drift/rotation/fade, staggered start —
// a TV-Time-style celebratory burst, no confetti library needed since Reanimated already
// covers everything this needs (shared values + interpolate + withTiming).
export function ConfettiBurst({ onComplete }: ConfettiBurstProps) {
    const particles = useMemo(() => buildParticles(), [])

    useEffect(() => {
        const timeout = setTimeout(onComplete, DURATION + 200)
        return () => clearTimeout(timeout)
    }, [ onComplete ])

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            {particles.map((particle) => (
                <Particle key={particle.id} config={particle} />
            ))}
        </View>
    )
}
