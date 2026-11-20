import React from 'react';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors, stroke } from '../theme/tokens';

type Props = {
  data: number[];
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  gapZero?: boolean;
};

type Pt = { x: number; y: number };

/** Minimal monochrome chart: connects adjacent valid points, dots isolated ones. */
export default function LineChart({ data, width = 320, height = 90, min, max, gapZero = true }: Props) {
  const clean = data.slice(0, 288);
  if (clean.length < 2) return null;
  const vals = clean.filter(v => v > 0);
  if (vals.length === 0) return null;
  const lo = min ?? Math.max(0, Math.min(...vals) - 5);
  const hi = max ?? Math.max(...vals) + 5;
  const span = hi - lo || 1;
  const yOf = (v: number) => height - ((v - lo) / span) * height;

  // Collect runs of consecutive valid samples.
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  clean.forEach((v, i) => {
    const valid = !(gapZero && v === 0);
    if (valid) {
      run.push({ x: (i / (clean.length - 1)) * width, y: yOf(v) });
    } else if (run.length) {
      runs.push(run); run = [];
    }
  });
  if (run.length) runs.push(run);

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {runs.map((r, i) => r.length > 1
        ? <Polyline key={`l${i}`} points={r.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none" stroke={colors.ink} strokeWidth={stroke.thin} />
        : <Circle key={`d${i}`} cx={r[0].x} cy={r[0].y} r={2.5} fill={colors.ink} />
      )}
    </Svg>
  );
}
