import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import Screen from '../../ui/Screen';
import { colors, type, space, stroke, radius } from '../../theme/tokens';
import { useVitals } from '../../core/store';
import { ble } from '../../core/ble/BleService';
import { useConnection } from '../../core/ble/useConnection';
import { historySync } from '../../core/sync/HistorySync';
import { syncCoordinator } from '../../core/sync/SyncCoordinator';
import { largeData } from '../../core/sync/LargeData';

const stateLabel: Record<string, string> = {
  idle: 'OFFLINE', scanning: 'SCANNING', connecting: 'CONNECTING',
  connected: 'ONLINE', error: 'ERROR',
};

export default function DeviceScreen({ onGoAlarms, onGoCalendar, onGoNotificationDebug }: { onGoAlarms?: () => void; onGoCalendar?: () => void; onGoNotificationDebug?: () => void }) {
  const v = useVitals();
  const { connect, disconnect } = useConnection();

  useEffect(() => {
    if (v.conn === 'connected') {
      ble.battery().catch(() => {});
      ble.readRssi().then(rssi => v.setVitals({ rssi })).catch(() => {});
    }
  }, [v.conn]);

  const rows: Array<[string, string, (() => void) | undefined]> = [
    ['HAPTICS', 'READY', undefined],
    ['ALARMS', 'ON DEVICE', onGoAlarms],
    ['CALENDAR', 'LINK APPS', onGoCalendar],
    ['NOTIFICATIONS', 'BAND BUZZ', onGoNotificationDebug],
    ['SYNC', v.conn === 'connected' ? 'READY' : '—', undefined],
    ['FIRMWARE', v.conn === 'connected' ? 'CURRENT' : '—', undefined],
  ];

  return (
    <Screen eyebrow={v.deviceName.toUpperCase()} right={
      <View style={styles.badge}>
        <View style={[styles.dot, v.conn === 'connected' && styles.dotOn]} />
        <Text style={styles.badgeText}>{stateLabel[v.conn]}</Text>
      </View>
    } scroll>
      <View style={styles.hero}>
        <View style={styles.battery}>
          <Text style={styles.batteryNum}>{v.battery || '—'}<Text style={styles.pct}>%</Text></Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.infoMain}>{v.hardware}</Text>
          <Text style={styles.infoSub}>{v.firmware}</Text>
          <Text style={styles.infoSub}>{v.rssi ? `${v.rssi} dBm` : '— dBm'} · MTU 247</Text>
        </View>
      </View>

      {v.connError ? <Text style={styles.error}>{v.connError}</Text> : null}

      {v.conn === 'connected' ? (
        <Pressable onPress={disconnect} style={[styles.btn, styles.btnGhost]}>
          <Text style={styles.btnTextGhost}>DISCONNECT</Text>
        </Pressable>
      ) : (
        <Pressable onPress={connect} disabled={v.conn === 'scanning' || v.conn === 'connecting'}
          style={[styles.btn, (v.conn === 'scanning' || v.conn === 'connecting') && styles.btnDisabled]}>
          {v.conn === 'scanning' || v.conn === 'connecting'
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.btnText}>CONNECT TO BAND</Text>}
        </Pressable>
      )}

      <Pressable onPress={() => ble.findBand().catch(() => {})} style={styles.linkBtn}>
        <Text style={styles.linkText}>BUZZ BAND</Text>
      </Pressable>

      {v.conn === 'connected' ? (
        <Pressable onPress={async () => {
          v.setVitals({ syncing: true });
          await historySync.syncAll(0);
          v.setVitals({ syncing: false });
        }} disabled={v.syncing} style={[styles.linkBtn, v.syncing && styles.disabled]}>
          <Text style={styles.linkText}>{v.syncing ? 'SYNCING…' : 'SYNC HISTORY'}</Text>
        </Pressable>
      ) : null}

      {v.conn === 'connected' ? (
        <Pressable onPress={async () => {
          v.setVitals({ syncing: true });
          await syncCoordinator.catchUp(7);
        }} disabled={v.syncing} style={[styles.linkBtn, v.syncing && styles.disabled]}>
          <Text style={styles.linkText}>{v.syncing ? 'SYNCING 7 DAYS…' : 'SYNC 7 DAYS'}</Text>
        </Pressable>
      ) : null}

      {v.conn === 'connected' ? (
        <Pressable onPress={async () => {
          v.setVitals({ syncing: true });
          await largeData.collect(0x2a, [0x02]);
          v.setVitals({ syncing: false });
        }} disabled={v.syncing} style={[styles.linkBtn, v.syncing && styles.disabled]}>
          <Text style={styles.linkText}>SYNC SPO₂ (SPP)</Text>
        </Pressable>
      ) : null}

      {v.conn === 'connected' ? (
        <Pressable onPress={async () => {
          v.setVitals({ syncing: true });
          await largeData.collect(0x27, [0x07, 0x01]);
          v.setVitals({ syncing: false });
        }} disabled={v.syncing} style={[styles.linkBtn, v.syncing && styles.disabled]}>
          <Text style={styles.linkText}>SYNC SLEEP (SPP)</Text>
        </Pressable>
      ) : null}

      <View style={styles.list}>
        {rows.map(([label, value, action]) => (
          <Pressable key={label} onPress={action} style={styles.row}>
            <View style={styles.ico} />
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}{action ? '  ›' : ''}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: stroke.hairline,
    borderColor: colors.hairline, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hairlineStrong },
  dotOn: { backgroundColor: colors.ink },
  badgeText: { ...type.micro, color: colors.inkSecondary },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 26, marginVertical: space.lg },
  battery: { width: 104, height: 104, borderRadius: 52, borderWidth: stroke.hairline,
    borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  batteryNum: { ...type.title, color: colors.ink },
  pct: { fontSize: 12, color: colors.inkSecondary },
  info: { flex: 1 },
  infoMain: { fontSize: 14, color: colors.ink, letterSpacing: 1.4, marginBottom: 6 },
  infoSub: { fontSize: 11, color: colors.inkSecondary, lineHeight: 20 },
  error: { ...type.caption, color: colors.ink, marginBottom: 12, letterSpacing: 0 },
  btn: { height: 54, borderRadius: radius.md, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  btnDisabled: { opacity: 0.5 },
  btnText: { ...type.caption, color: colors.bg },
  btnGhost: { backgroundColor: colors.surface, borderWidth: stroke.hairline, borderColor: colors.hairlineStrong },
  btnTextGhost: { ...type.caption, color: colors.ink },
  linkBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...type.micro, color: colors.inkSecondary },
  disabled: { opacity: 0.4 },
  list: { borderTopWidth: stroke.hairline, borderTopColor: colors.hairline, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15,
    borderBottomWidth: stroke.hairline, borderBottomColor: colors.fillSoft },
  ico: { width: 14, height: 14, borderRadius: 3, borderWidth: stroke.hairline, borderColor: colors.inkTertiary },
  label: { ...type.micro, color: colors.inkSecondary },
  value: { ...type.caption, color: colors.ink, marginLeft: 'auto', letterSpacing: 1 },
});
