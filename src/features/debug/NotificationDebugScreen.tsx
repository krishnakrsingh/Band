import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Screen from '../../ui/Screen';
import { colors, type, space, stroke, radius } from '../../theme/tokens';
import { useNotificationStore } from '../../core/notifications/notificationStore';
import {
  notificationBridge,
  refreshNotificationStatus,
  triggerTestBuzz,
} from '../../core/notifications/NotificationForwarder';

const fmtTime = (t: number | null): string => {
  if (!t) return '—';
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const yesNo = (v: boolean | null): string => (v == null ? 'UNKNOWN' : v ? 'YES' : 'NO');

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/** Monochrome diagnostics for the notification → band-haptic chain. */
export default function NotificationDebugScreen({ onBack }: { onBack?: () => void }) {
  const s = useNotificationStore();

  const openAccess = () => {
    try {
      notificationBridge?.openAccessSettings();
    } catch {
      // Bridge may be partially implemented — the caller cell still shows status.
    }
  };

  return (
    <Screen
      eyebrow="NOTIFICATION DEBUG"
      right={<Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.done}>DONE ›</Text></Pressable>}
      scroll
    >
      <View style={styles.section}>
        <InfoRow label="BRIDGE PRESENT" value={yesNo(s.bridgePresent)} />
        <InfoRow label="ACCESS ENABLED" value={yesNo(s.accessEnabled)} />
        <InfoRow label="EVENT COUNT" value={String(s.eventCount)} />
        <InfoRow label="LAST PATTERN" value={s.lastPattern?.toUpperCase() ?? '—'} />
        <InfoRow label="LAST TIME" value={fmtTime(s.lastTime)} />
        <InfoRow label="LAST SKIPPED REASON" value={s.lastSkippedReason ?? '—'} />
        <InfoRow label="LAST BUZZ RESULT" value={s.lastBuzzResult ?? '—'} />
        {s.lastError ? <InfoRow label="LAST ERROR" value={s.lastError} /> : null}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={() => void triggerTestBuzz('call')} accessibilityRole="button">
          <Text style={styles.btnText}>TEST BUZZ (CALL)</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => void triggerTestBuzz('whatsapp')} accessibilityRole="button">
          <Text style={styles.btnText}>TEST BUZZ (WHATSAPP)</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={openAccess} accessibilityRole="button">
          <Text style={styles.btnTextGhost}>OPEN ACCESS SETTINGS</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => void refreshNotificationStatus()} accessibilityRole="button">
          <Text style={styles.btnTextGhost}>REFRESH</Text>
        </Pressable>
      </View>

      <Text style={styles.listTitle}>LAST 10 EVENTS</Text>
      <View style={styles.list}>
        {s.events.length === 0 ? (
          <Text style={styles.empty}>No events yet. Trigger a notification or press TEST BUZZ.</Text>
        ) : (
          s.events.map((e) => (
            <View key={e.seq} style={styles.row}>
              <Text style={styles.seq}>{e.seq}</Text>
              <View style={styles.evtBody}>
                <Text style={styles.evtTop}>
                  <Text style={styles.evtPattern}>{e.pattern?.toUpperCase() ?? '—'}</Text>
                  <Text style={styles.evtTime}>{fmtTime(e.at)}</Text>
                </Text>
                <Text style={[styles.evtResult, e.skipped && styles.evtSkipped]}>{e.result}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: { ...type.micro, color: colors.inkSecondary },
  section: { borderTopWidth: stroke.hairline, borderTopColor: colors.hairline },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: space.sm, paddingVertical: 11, borderBottomWidth: stroke.hairline, borderBottomColor: colors.fillSoft },
  infoLabel: { ...type.micro, color: colors.inkSecondary, flexShrink: 0 },
  infoValue: { ...type.caption, color: colors.ink, letterSpacing: 0, textAlign: 'right', flexShrink: 1 },

  actions: { marginVertical: space.lg, gap: 8 },
  btn: { height: 50, borderRadius: radius.md, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center' },
  btnText: { ...type.caption, color: colors.bg },
  btnGhost: { backgroundColor: colors.surface, borderWidth: stroke.hairline, borderColor: colors.hairlineStrong },
  btnTextGhost: { ...type.caption, color: colors.ink },

  listTitle: { ...type.caption, color: colors.inkSecondary, marginBottom: space.sm },
  list: { borderTopWidth: stroke.hairline, borderTopColor: colors.hairline },
  empty: { ...type.body, color: colors.inkTertiary, paddingVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
    paddingVertical: 11, borderBottomWidth: stroke.hairline, borderBottomColor: colors.fillSoft },
  seq: { ...type.micro, color: colors.inkTertiary, width: 20, paddingTop: 2 },
  evtBody: { flex: 1 },
  evtTop: { flexDirection: 'row', justifyContent: 'space-between' },
  evtPattern: { ...type.caption, color: colors.ink, letterSpacing: 1 },
  evtTime: { ...type.micro, color: colors.inkSecondary },
  evtResult: { ...type.body, color: colors.ink, fontSize: 12, marginTop: 3 },
  evtSkipped: { color: colors.inkSecondary },
});
