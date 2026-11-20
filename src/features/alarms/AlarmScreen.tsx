import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Alert } from 'react-native';
import Screen from '../../ui/Screen';
import { colors, type, space, stroke, radius } from '../../theme/tokens';
import { useAlarms, type BandAlarm } from './AlarmStore';
import { useVitals } from '../../core/store';
import { saveSettings, loadSettings } from '../../core/persistence';
import { ble } from '../../core/ble/BleService';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function AlarmScreen({ onBack }: { onBack?: () => void }) {
  const a = useAlarms();
  const connected = useVitals(s => s.conn === 'connected');
  const [h, setH] = useState(7);
  const [m, setM] = useState(0);
  const [mask, setMask] = useState(0x7f);
  const [editing, setEditing] = useState<number | null>(null);

  const toggleDay = (d: number) => setMask(prev => prev ^ (1 << d));

  const persist = async () => {
    const s = await loadSettings();
    await saveSettings({ ...s, alarms: useAlarms.getState().alarms });
  };

  const save = async () => {
    const id = editing ?? (a.alarms.length < 5 ? Math.max(-1, ...a.alarms.map(x => x.id)) + 1 : 0);
    if (id > 4) { Alert.alert('Only 5 hardware alarm slots'); return; }
    const alarm: BandAlarm = { id, enabled: true, hour: h, minute: m, weekMask: mask,
      label: editing != null ? (a.alarms.find(x => x.id === editing)?.label ?? '') : '' };
    a.upsert(alarm);
    await persist();
    if (connected) {
      try { await a.pushToBand(alarm); } catch { Alert.alert('Could not push alarm to band'); }
    }
    setEditing(null);
  };

  const toggle = async (alarm: BandAlarm) => {
    const next = { ...alarm, enabled: !alarm.enabled };
    a.upsert(next); await persist();
    if (connected) { try { await a.pushToBand(next); } catch {} }
  };

  const remove = async (id: number) => {
    a.remove(id); await persist();
    if (connected) {
      try { await ble.write(0x23, [id, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); } catch {}
    }
  };

  const load = (alarm: BandAlarm) => {
    setEditing(alarm.id); setH(alarm.hour); setM(alarm.minute); setMask(alarm.weekMask);
  };

  return (
    <Screen eyebrow="ALARMS" right={<Pressable onPress={onBack}><Text style={styles.count}>DONE ›</Text></Pressable>} scroll>
      <View style={styles.timeRow}>
        <TimeStep value={h} onChange={setH} max={23} label="H" />
        <Text style={styles.colon}>:</Text>
        <TimeStep value={m} onChange={setM} max={59} label="M" />
      </View>

      <View style={styles.days}>
        {DAYS.map((d, i) => (
          <Pressable key={i} onPress={() => toggleDay(i)}
            style={[styles.day, ((mask >> i) & 1) === 1 && styles.dayOn]}>
            <Text style={[styles.dayText, ((mask >> i) & 1) === 1 && styles.dayTextOn]}>{d}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={save} style={styles.saveBtn}>
        <Text style={styles.saveText}>{editing != null ? 'UPDATE ALARM' : 'ADD ALARM TO BAND'}</Text>
      </Pressable>
      {editing != null ? <Pressable onPress={() => setEditing(null)}><Text style={styles.cancel}>CANCEL</Text></Pressable> : null}

      <View style={styles.list}>
        {a.alarms.length === 0 ? <Text style={styles.empty}>NO ALARMS · SILENT WAKE VIA HAPTICS</Text> : null}
        {a.alarms.map(al => (
          <View key={al.id} style={styles.alarmRow}>
            <Pressable onPress={() => toggle(al)} style={[styles.check, al.enabled && styles.checkOn]} />
            <Pressable onPress={() => load(al)} style={styles.alarmInfo}>
              <Text style={[styles.alarmTime, !al.enabled && styles.dim]}>
                {String(al.hour).padStart(2, '0')}:{String(al.minute).padStart(2, '0')}
              </Text>
              <Text style={styles.alarmDays}>{DAYS.map((d, i) => ((al.weekMask >> i) & 1) === 1 ? d : '·').join(' ')}</Text>
            </Pressable>
            <Pressable onPress={() => remove(al.id)}><Text style={styles.del}>×</Text></Pressable>
          </View>
        ))}
      </View>
      <Text style={styles.foot}>{connected ? 'WRITES GO TO THE BAND VIA BLE' : 'CONNECT BAND TO SYNC ALARMS'}</Text>
    </Screen>
  );
}

function TimeStep({ value, onChange, max, label }: { value: number; onChange: (v: number) => void; max: number; label: string }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange((value - 1 + max + 1) % (max + 1))} style={styles.sBtn}>
        <Text style={styles.sText}>−</Text></Pressable>
      <Text style={styles.sValue}>{String(value).padStart(2, '0')}</Text>
      <Pressable onPress={() => onChange((value + 1) % (max + 1))} style={styles.sBtn}>
        <Text style={styles.sText}>+</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  count: { ...type.caption, color: colors.inkSecondary },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginVertical: space.lg },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: stroke.hairline,
    borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  sText: { fontSize: 22, color: colors.ink, fontWeight: '300' },
  sValue: { ...type.display, color: colors.ink, minWidth: 110, textAlign: 'center' },
  colon: { ...type.display, color: colors.inkTertiary },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.lg },
  day: { width: 40, height: 40, borderRadius: 20, borderWidth: stroke.hairline,
    borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayText: { ...type.caption, color: colors.inkSecondary },
  dayTextOn: { color: colors.bg },
  saveBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center' },
  saveText: { ...type.caption, color: colors.bg },
  cancel: { ...type.micro, color: colors.inkSecondary, textAlign: 'center', marginTop: 12 },
  list: { marginTop: space.xl, borderTopWidth: stroke.hairline, borderTopColor: colors.hairline },
  empty: { ...type.micro, color: colors.inkTertiary, textAlign: 'center', paddingVertical: 30 },
  alarmRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16,
    borderBottomWidth: stroke.hairline, borderBottomColor: colors.fillSoft },
  check: { width: 18, height: 18, borderRadius: 9, borderWidth: stroke.hairline, borderColor: colors.hairlineStrong },
  checkOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  alarmInfo: { flex: 1 },
  alarmTime: { ...type.metric, color: colors.ink },
  dim: { color: colors.inkTertiary },
  alarmDays: { ...type.micro, color: colors.inkTertiary, marginTop: 4 },
  del: { fontSize: 22, color: colors.inkTertiary },
  foot: { ...type.micro, color: colors.inkTertiary, textAlign: 'center', marginTop: space.xl },
});
