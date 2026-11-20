import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, stroke } from '../theme/tokens';

type P = { color?: string; size?: number };
const base = (p: P) => ({
  width: p.size ?? 22, height: p.size ?? 22, viewBox: '0 0 24 24', fill: 'none',
  stroke: p.color ?? colors.ink, strokeWidth: stroke.thin,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

export const IconToday = (p: P) => (
  <Svg {...base(p)}><Circle cx={12} cy={12} r={8} /><Path d="M12 7v5l3 2" /></Svg>
);
export const IconLive = (p: P) => (
  <Svg {...base(p)}><Path d="M2 12h4l2-6 3 12 3-9 2 3h6" /></Svg>
);
export const IconSleep = (p: P) => (
  <Svg {...base(p)}><Path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></Svg>
);
export const IconRecovery = (p: P) => (
  <Svg {...base(p)}><Path d="M4 17l5-6 4 3 7-8" /><Path d="M16 6h4v4" /></Svg>
);
export const IconDevice = (p: P) => (
  <Svg {...base(p)}><Rect x={7} y={3} width={10} height={18} rx={3} /><Path d="M11 18h2" /></Svg>
);
export const IconProfile = (p: P) => (
  <Svg {...base(p)}><Circle cx={12} cy={8} r={4} /><Path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" /></Svg>
);
