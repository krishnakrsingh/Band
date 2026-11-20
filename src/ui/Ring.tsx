import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, stroke } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = { value: number; max?: number; size?: number };

export default function Ring({ value, max = 100, size = 220 }: Props) {
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    Animated.timing(progress, {
      toValue: Math.min(1, Math.max(0, value / max)),
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, max, progress]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, circumference * (1 - Math.min(1, Math.max(0, value / max)))],
  });

  return (
    <Svg width={size} height={size} style={{ alignSelf: 'center' }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.hairline}
        strokeWidth={stroke.thin} fill="none" />
      <AnimatedCircle
        cx={size / 2} cy={size / 2} r={r} stroke={colors.ink}
        strokeWidth={stroke.bold} fill="none" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={dashOffset as any}
        rotation={-90} originX={size / 2} originY={size / 2}
      />
    </Svg>
  );
}
