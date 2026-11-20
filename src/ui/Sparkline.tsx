import React from 'react';
import Svg, { Polyline } from 'react-native-svg';
import { colors, stroke } from '../theme/tokens';

type Props = { data: number[]; width?: number; height?: number };

export default function Sparkline({ data, width = 92, height = 24 }: Props) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / span) * height}`,
  ).join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={pts} fill="none" stroke={colors.inkSecondary} strokeWidth={stroke.thin} />
    </Svg>
  );
}
