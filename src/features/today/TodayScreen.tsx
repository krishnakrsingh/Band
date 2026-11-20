import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Ring from '../../ui/Ring';
import Metric from '../../ui/Metric';
import { colors, type, space, stroke } from '../../theme/tokens';
import { useVitals } from '../../core/store';

export default function TodayScreen({ onGoDevice }: { onGoDevice: () => void }) {
  const v = useVitals();
  const connected = v.conn === 'connected';

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>TODAY</Text>
        <View style={styles.avatar} />
      </View>

      <View style={styles.hero}>
        <Ring value={82} size={214} />
        <View style={styles.center}>
          <Text style={styles.number}>82</Text>
          <Text style={styles.caption}>READY</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric label="HEART RATE" value={v.heartRate ? String(v.heartRate) : '—'} unit="bpm"
          trend={v.ppg.length > 4 ? v.ppg.slice(-7).map(x => x * 100) : undefined} />
        <Metric label="STEPS" value={v.steps ? String(v.steps) : '—'} unit=""
          trend={undefined} />
        <Metric label="BATTERY" value={v.battery ? String(v.battery) : '—'} unit="%"
          trend={[90, 88, 85, 83, 81, 80, 79]} />
      </View>

      <Pressable onPress={onGoDevice} style={styles.status}>
        <View style={[styles.dot, connected && styles.dotOn]} />
        <Text style={styles.statusText}>
          {connected ? 'BAND CONNECTED · TAP FOR DETAILS' : 'BAND OFFLINE · TAP TO CONNECT'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.xl, marginBottom: space.lg },
  eyebrow: { ...type.caption, color: colors.inkSecondary },
  avatar: { width: 26, height: 26, borderRadius: 13, borderWidth: stroke.hairline,
    borderColor: colors.hairlineStrong, backgroundColor: colors.fillSoft },
  hero: { alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 32, height: 214 },
  center: { position: 'absolute', alignItems: 'center' },
  number: { ...type.hero, color: colors.ink },
  caption: { ...type.micro, color: colors.inkSecondary, marginTop: 8 },
  metrics: { flexDirection: 'row', borderTopWidth: stroke.hairline,
    borderTopColor: colors.hairline, paddingTop: space.lg },
  status: { marginTop: 'auto', marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.hairlineStrong },
  dotOn: { backgroundColor: colors.ink },
  statusText: { ...type.micro, color: colors.inkTertiary },
});
