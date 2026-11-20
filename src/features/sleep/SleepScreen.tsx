import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../ui/Screen';
import { colors, type, space, stroke } from '../../theme/tokens';
import { useVitals, type SleepStage } from '../../core/store';

const height: Record<string, number> = { 1: 52, 2: 100, 4: 76, 3: 140 }; // deep/light/rem/awake
const opacity: Record<string, number> = { 1: 1, 2: 0.45, 4: 0.7, 3: 0.9 };
const stageName: Record<number, string> = { 1: 'DEEP', 2: 'LIGHT', 3: 'AWAKE', 4: 'REM' };

const fmt = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}` : `${m}m`;

/** Expand merged stages into renderable bars (cap to avoid huge arrays). */
function expand(stages: SleepStage[]): number[] {
  const out: number[] = [];
  for (const s of stages) {
    const bars = Math.max(1, Math.min(24, Math.round(s.d / 10)));
    for (let i = 0; i < bars; i++) out.push(s.t);
  }
  return out;
}

export default function SleepScreen() {
  const v = useVitals();
  const session = v.sleepSessions[0];
  const bars = session ? expand(session.stages) : [];

  return (
    <Screen eyebrow="LAST NIGHT" right={<View style={styles.score}>
      <Text style={styles.scoreText}>{session ? Math.round(session.totalMinutes / 4.3) : '—'}</Text>
    </View>}>
      <Text style={styles.time}>
        {session ? `${session.totalMinutes} MIN · DAY ${session.dayIndex}` : 'NO SLEEP DATA'}
      </Text>
      <View style={styles.chart}>
        {bars.length > 0 ? bars.map((t, i) => (
          <View key={i} style={[styles.bar, { height: height[t] ?? 60, opacity: opacity[t] ?? 0.6 }]} />
        )) : (
          <Text style={styles.emptyChart}>SYNC SLEEP TO SEE STAGES</Text>
        )}
      </View>
      {session ? (
        <View style={styles.legend}>
          <Legend name="DEEP" value={fmt(session.deepMinutes)} opacity={1} />
          <Legend name="LIGHT" value={fmt(session.lightMinutes)} opacity={0.45} />
          <Legend name="REM" value={fmt(session.remMinutes)} opacity={0.7} />
          <Legend name="AWAKE" value={fmt(session.awakeMinutes)} opacity={0.9} />
        </View>
      ) : null}
    </Screen>
  );
}

function Legend({ name, value, opacity }: { name: string; value: string; opacity: number }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { opacity }]} />
      <Text style={styles.legendName}>{name}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  score: { borderWidth: stroke.hairline, borderColor: colors.hairlineStrong,
    borderRadius: 22, paddingHorizontal: 13, paddingVertical: 5 },
  scoreText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  time: { ...type.title, color: colors.ink, marginBottom: 24 },
  chart: { height: 200, flexDirection: 'row', alignItems: 'flex-end', gap: 2,
    borderLeftWidth: stroke.hairline, borderBottomWidth: stroke.hairline,
    borderColor: colors.hairline, paddingHorizontal: 2, justifyContent: 'center' },
  bar: { width: '2.5%', backgroundColor: colors.ink, borderRadius: 2 },
  emptyChart: { ...type.micro, color: colors.inkTertiary },
  legend: { marginTop: space.lg, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7, width: '46%' },
  swatch: { width: 12, height: 2, backgroundColor: colors.ink },
  legendName: { ...type.micro, color: colors.inkTertiary },
  legendValue: { ...type.caption, color: colors.ink, marginLeft: 'auto', letterSpacing: 0 },
});
