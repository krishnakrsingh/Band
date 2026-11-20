import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import Screen from '../../ui/Screen';
import { colors, type, space, stroke, radius } from '../../theme/tokens';
import { useVitals } from '../../core/store';
import { ble } from '../../core/ble/BleService';
import LineChart from '../../ui/LineChart';

export default function LiveScreen() {
  const v = useVitals();
  const connected = v.conn === 'connected';

  const start = () => {
    ble.startRawPpg('green').then(() => v.setVitals({ streaming: true })).catch(() => {});
  };
  const stop = () => {
    ble.stopRawPpg().then(() => ble.stopHr()).catch(() => {});
    v.setVitals({ streaming: false, hrStreaming: false });
  };
  const startHr = () => {
    ble.startHr().then(() => v.setVitals({ hrStreaming: true })).catch(() => {});
  };

  const points = v.ppg.length > 1
    ? v.ppg.map((value, i) => `${(i / (v.ppg.length - 1)) * 320},${70 - value * 60}`).join(' ')
    : '';

  return (
    <Screen eyebrow="LIVE SIGNAL" right={<Text style={styles.badge}>25 Hz</Text>} scroll>
      <Text style={styles.hr}>{v.heartRate || '—'}<Text style={styles.unit}>BPM</Text></Text>

      <View style={styles.wave}>
        {v.streaming && points ? (
          <Svg width="100%" height="140" viewBox="0 0 320 140" preserveAspectRatio="none">
            <Polyline points={points} fill="none" stroke={colors.ink} strokeWidth={stroke.thin} />
          </Svg>
        ) : (
          <View style={styles.waveEmpty}>
            <Text style={styles.waveText}>{connected ? 'TAP TO STREAM' : 'CONNECT BAND FIRST'}</Text>
          </View>
        )}
        <Text style={styles.legend}>GREEN · RED · IR</Text>
      </View>

      {!connected ? (
        <View style={styles.note}><Text style={styles.noteText}>GO TO BAND TAB → CONNECT</Text></View>
      ) : !v.streaming ? (
        <Pressable onPress={start} style={styles.btn}>
          <Text style={styles.btnText}>START LIVE STREAM</Text>
        </Pressable>
      ) : (
        <Pressable onPress={stop} style={[styles.btn, styles.btnGhost]}>
          <Text style={styles.btnTextGhost}>STOP STREAM</Text>
        </Pressable>
      )}

      {v.streaming && !v.hrStreaming ? (
        <Pressable onPress={startHr} style={styles.linkBtn}>
          <Text style={styles.linkText}>ENABLE ON-DEVICE HR</Text>
        </Pressable>
      ) : null}

      <View style={styles.signal}>
        <Signal label="CONTACT" value={v.onWrist ? 100 : 0} />
        <Signal label="RRI" value={v.rri ? Math.min(100, Math.round((v.rri / 1200) * 100)) : 0} />
        <Signal label="SPO₂" value={v.spo2 ? v.spo2 : 0} />
      </View>

      <View style={styles.foot}>
        <Text style={styles.footText}>RRI <Text style={styles.bold}>{v.rri || '—'}</Text> ms</Text>
        <Text style={styles.footText}>SpO₂ <Text style={styles.bold}>{v.spo2 || '—'}</Text> %</Text>
      </View>

      {v.spo2Min.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.historyLabel}>24H SPO₂ · HOURLY (SYNCED)</Text>
          <LineChart data={v.spo2Min} height={70} min={85} max={100} />
          <Text style={styles.historyFoot}>
            MIN {Math.min(...v.spo2Min)}% · MAX {Math.max(...v.spo2Max)}% (24h)
          </Text>
        </View>
      ) : null}

      {v.hrHistory.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.historyLabel}>24H HEART RATE · 5 MIN SLOTS</Text>
          <LineChart data={v.hrHistory} height={80} min={40} max={180} />
          <Text style={styles.historyFoot}>
            {v.hrHistory.filter(x => x > 0).length} / {v.hrHistory.length} SLOTS
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

function Signal({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.signalItem}>
      <Text style={styles.signalLabel}>{label}</Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { ...type.micro, color: colors.inkSecondary, borderWidth: stroke.hairline,
    borderColor: colors.hairline, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  hr: { ...type.display, color: colors.ink, marginTop: -4 },
  unit: { fontSize: 12, color: colors.inkSecondary, marginLeft: 8, letterSpacing: 3 },
  wave: { height: 180, borderWidth: stroke.hairline, borderColor: colors.hairline,
    borderRadius: radius.md, justifyContent: 'center', backgroundColor: colors.surface, overflow: 'hidden' },
  waveEmpty: { alignItems: 'center', justifyContent: 'center', height: 140 },
  waveText: { ...type.micro, color: colors.inkTertiary },
  legend: { ...type.micro, color: colors.inkTertiary, position: 'absolute', left: 12, bottom: 10 },
  note: { marginTop: space.md, alignItems: 'center' },
  noteText: { ...type.micro, color: colors.inkTertiary },
  btn: { height: 54, borderRadius: radius.md, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', marginTop: space.md },
  btnText: { ...type.caption, color: colors.bg },
  btnGhost: { backgroundColor: colors.surface, borderWidth: stroke.hairline, borderColor: colors.hairlineStrong },
  btnTextGhost: { ...type.caption, color: colors.ink },
  linkBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...type.micro, color: colors.inkSecondary },
  signal: { flexDirection: 'row', gap: 12, marginTop: space.lg },
  signalItem: { flex: 1 },
  signalLabel: { ...type.micro, color: colors.inkTertiary },
  track: { height: 2, backgroundColor: colors.hairline, marginTop: 8 },
  fill: { height: 2, backgroundColor: colors.ink },
  foot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  footText: { ...type.caption, color: colors.inkSecondary },
  bold: { color: colors.ink, fontWeight: '600' },
  history: { marginTop: space.xl, borderTopWidth: stroke.hairline, borderTopColor: colors.hairline, paddingTop: 16 },
  historyLabel: { ...type.micro, color: colors.inkTertiary, marginBottom: 12 },
  historyFoot: { ...type.micro, color: colors.inkTertiary, marginTop: 8, textAlign: 'right' },
});
