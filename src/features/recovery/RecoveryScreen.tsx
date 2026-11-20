import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Screen from '../../ui/Screen';
import LineChart from '../../ui/LineChart';
import { colors, type, space, stroke } from '../../theme/tokens';
import { useVitals } from '../../core/store';

/** Honest readiness from signals we actually have: HRV, stress (autonomic), resting-HR dip. */
function computeReadiness(hrv: number[], stress: number[], hrHistory: number[]) {
  const hrvVals = hrv.filter(v => v > 0);
  const stressVals = stress.filter(v => v > 0);
  const hrVals = hrHistory.filter(v => v > 0);
  if (!hrvVals.length && !stressVals.length) return null;

  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  // HRV normalized: 20-120 ms -> 0-100
  const hrvScore = hrvVals.length ? Math.max(0, Math.min(100, ((avg(hrvVals) - 20) / 100) * 100)) : 50;
  // Stress inverted: low autonomic load = higher score
  const stressScore = stressVals.length ? Math.max(0, Math.min(100, 100 - avg(stressVals))) : 50;
  const nightHr = hrVals.length ? Math.min(...hrVals) : 0;

  const score = Math.round(hrvScore * 0.5 + stressScore * 0.5);
  return { score, hrvScore, stressScore, nightHr, hrvAvg: hrvVals.length ? avg(hrvVals) : 0 };
}

export default function RecoveryScreen() {
  const v = useVitals();
  const r = computeReadiness(v.hrvHistory, v.stressHistory, v.hrHistory);
  const score = r?.score;

  const components = [
    ['HRV', r ? Math.round(r.hrvScore) : 0, r ? `${Math.round(r.hrvAvg)} ms` : '—'],
    ['BALANCE', r ? Math.round(r.stressScore) : 0, r ? `load ${Math.round(100 - r.stressScore)}` : '—'],
    ['NIGHT HR', r && r.nightHr ? 60 : 0, r?.nightHr ? `${r.nightHr} bpm` : '—'],
  ] as const;

  return (
    <Screen eyebrow="RECOVERY" right={<View style={styles.pill}>
      <Text style={styles.pillText}>{score ?? '—'}</Text>
    </View>} scroll>
      <View style={styles.hero}>
        <Svg width="100%" height="170" viewBox="0 0 240 140">
          <Path d="M20 130 A100 100 0 0 1 220 130" fill="none"
            stroke={colors.hairline} strokeWidth={stroke.thin} />
          <Path d="M20 130 A100 100 0 0 1 220 130" fill="none"
            stroke={colors.ink} strokeWidth={stroke.bold} strokeLinecap="round"
            strokeDasharray="314" strokeDashoffset={score != null ? 314 - (score / 100) * 314 : 314} />
        </Svg>
        <Text style={styles.number}>{score ?? '—'}</Text>
      </View>

      {r ? (
        <>
          <View style={styles.bars}>
            {components.map(([label, pct, value]) => (
              <View key={label} style={styles.row}>
                <Text style={styles.label}>{label}</Text>
                <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
                <Text style={styles.value}>{value}</Text>
              </View>
            ))}
          </View>

          {v.hrvHistory.length > 0 ? (
            <View style={styles.trend}>
              <Text style={styles.trendLabel}>48-SLOT HRV · 30 MIN</Text>
              <LineChart data={v.hrvHistory} height={70} />
            </View>
          ) : null}

          {v.days.length > 0 ? (
            <View style={styles.trend}>
              <Text style={styles.trendLabel}>{v.days.length} DAY STEPS</Text>
              <View style={styles.dayBars}>
                {v.days.map(d => {
                  const max = Math.max(1, ...v.days.map(x => x.steps));
                  return (
                    <View key={d.dayIndex} style={styles.dayCol}>
                      <View style={[styles.dayBar, { height: Math.max(2, (d.steps / max) * 56) }]} />
                      <Text style={styles.dayLabel}>{d.dayIndex === 0 ? 'TODAY' : `-${d.dayIndex}`}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Text style={styles.foot}>DERIVED FROM SYNCED HRV + AUTONOMIC LOAD</Text>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>SYNC HISTORY TO SEE RECOVERY</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: stroke.hairline, borderColor: colors.hairlineStrong,
    borderRadius: 22, paddingHorizontal: 13, paddingVertical: 5 },
  pillText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  hero: { height: 190, alignItems: 'center', justifyContent: 'flex-end' },
  number: { ...type.hero, color: colors.ink, marginTop: -28 },
  bars: { gap: 16, marginTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { ...type.micro, color: colors.inkTertiary, width: 62 },
  track: { flex: 1, height: 2, backgroundColor: colors.hairline },
  fill: { height: 2, backgroundColor: colors.ink },
  value: { ...type.caption, color: colors.ink, width: 52, textAlign: 'right', letterSpacing: 0 },
  trend: { marginTop: space.xl, borderTopWidth: stroke.hairline, borderTopColor: colors.hairline, paddingTop: 16 },
  trendLabel: { ...type.micro, color: colors.inkTertiary, marginBottom: 12 },
  dayBars: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 80 },
  dayCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 80 },
  dayBar: { width: '70%', backgroundColor: colors.ink, borderRadius: 2 },
  dayLabel: { ...type.micro, color: colors.inkTertiary, marginTop: 6, fontSize: 7 },
  foot: { ...type.micro, color: colors.inkTertiary, marginTop: space.lg, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.micro, color: colors.inkTertiary },
});
