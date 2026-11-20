import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import CalendarEvents, { type CalendarEventReadable } from 'react-native-calendar-events';
import Screen from '../../ui/Screen';
import { colors, type, space, stroke, radius } from '../../theme/tokens';
import { connectGoogle, restoreGoogleSession, disconnectGoogle } from '../../core/google/googleAuth';
import { fetchCalendarEvents, type GEvent } from '../../core/google/googleApis';
import { useGoogle } from '../../core/google/googleStore';
import { ble } from '../../core/ble/BleService';
import { loadSettings, saveSettings } from '../../core/persistence';

type LocalEvent = { id: string; title: string; startAt: number };

export default function CalendarScreen({ onBack }: { onBack?: () => void }) {
  const g = useGoogle();
  const [googleEvents, setGoogleEvents] = useState<GEvent[]>([]);
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    loadSettings().then(s => setCalm(s.calendarEnabled));
    (async () => {
      const session = await restoreGoogleSession();
      if (session) { g.setSession(session); await loadGoogle(); }
      else await loadLocal();
    })();
  }, []);

  const loadGoogle = async () => {
    setBusy(true); setError('');
    try { setGoogleEvents(await fetchCalendarEvents(7)); }
    catch (e: any) { setError(e?.message ?? 'Google Calendar failed'); }
    setBusy(false);
  };

  const loadLocal = async () => {
    const perm = await CalendarEvents.checkPermissions();
    if (perm !== 'authorized') {
      const r = await CalendarEvents.requestPermissions(true);
      if (r !== 'authorized') return;
    }
    const from = new Date(), to = new Date(Date.now() + 7 * 86400000);
    try {
      const es: CalendarEventReadable[] = await CalendarEvents.fetchAllEvents(from.toISOString(), to.toISOString());
      setLocalEvents((es || []).map((e, i) => ({ id: e.id || `l${i}`, title: e.title || '(no title)',
        startAt: new Date(e.startDate).getTime() })).sort((a, b) => a.startAt - b.startAt).slice(0, 12));
    } catch {}
  };

  const connect = async () => {
    setBusy(true); setError('');
    const r = await connectGoogle();
    if (r.ok) { g.setSession(r.session); await loadGoogle(); }
    else setError(r.error);
    setBusy(false);
  };

  const disconnect = async () => { await disconnectGoogle(); g.setSession(null); setGoogleEvents([]); };

  const toggleCalm = async () => {
    const next = !calm; setCalm(next);
    const s = await loadSettings(); await saveSettings({ ...s, calendarEnabled: next });
  };

  const fmt = (ms: number) => new Date(ms).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const eventTitle = (e: GEvent | LocalEvent) => (e as GEvent).summary ?? (e as LocalEvent).title ?? '(no title)';
  const events = g.session ? googleEvents : localEvents;

  return (
    <Screen eyebrow="CALENDAR" right={<Pressable onPress={onBack}><Text style={styles.done}>DONE ›</Text></Pressable>} scroll>
      {!g.session ? (
        <Pressable onPress={connect} disabled={busy} style={styles.connectBtn}>
          {busy ? <ActivityIndicator color={colors.bg} /> :
            <Text style={styles.connectText}>CONNECT GOOGLE</Text>}
        </Pressable>
      ) : (
        <View style={styles.account}>
          <View><Text style={styles.accountEmail}>{g.session.email}</Text>
            <Text style={styles.accountSub}>ONE LOGIN · CALENDAR / TASKS / FIT / GMAIL</Text></View>
          <Pressable onPress={disconnect}><Text style={styles.disconnect}>OUT</Text></Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={toggleCalm} style={styles.toggleRow}>
        <View style={[styles.check, calm && styles.checkOn]} />
        <Text style={styles.toggleText}>PRE-MEETING CALM BUZZ</Text>
      </Pressable>

      <Pressable onPress={g.session ? loadGoogle : loadLocal} style={styles.btn}>
        <Text style={styles.btnText}>REFRESH EVENTS</Text>
      </Pressable>

      <View style={styles.list}>
        {events.length === 0 && !busy ? <Text style={styles.empty}>NO UPCOMING EVENTS</Text> : null}
        {events.map((e, i) => (
          <View key={e.id ?? i} style={styles.event}>
            <Text style={styles.eventTitle}>{eventTitle(e)}</Text>
            <Text style={styles.eventTime}>{fmt(e.startAt)}{'allDay' in e && e.allDay ? ' · ALL DAY' : ''}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.foot}>EVENTS STAY ON YOUR PHONE · BAND ONLY BUZZES</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: { ...type.caption, color: colors.inkSecondary },
  connectBtn: { height: 52, borderRadius: radius.md, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  connectText: { ...type.caption, color: colors.bg },
  account: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: stroke.hairline, borderBottomColor: colors.hairline },
  accountEmail: { ...type.body, color: colors.ink },
  accountSub: { ...type.micro, color: colors.inkTertiary, marginTop: 4 },
  disconnect: { ...type.micro, color: colors.inkSecondary },
  error: { ...type.caption, color: colors.ink, marginTop: 8, letterSpacing: 0 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  check: { width: 18, height: 18, borderRadius: 9, borderWidth: stroke.hairline, borderColor: colors.hairlineStrong },
  checkOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleText: { ...type.caption, color: colors.ink },
  btn: { height: 50, borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: stroke.hairline, borderColor: colors.hairline,
    alignItems: 'center', justifyContent: 'center' },
  btnText: { ...type.caption, color: colors.ink },
  list: { marginTop: space.lg, borderTopWidth: stroke.hairline, borderTopColor: colors.hairline },
  empty: { ...type.micro, color: colors.inkTertiary, textAlign: 'center', paddingVertical: 30 },
  event: { paddingVertical: 14, borderBottomWidth: stroke.hairline, borderBottomColor: colors.fillSoft },
  eventTitle: { ...type.body, color: colors.ink },
  eventTime: { ...type.micro, color: colors.inkSecondary, marginTop: 4 },
  foot: { ...type.micro, color: colors.inkTertiary, textAlign: 'center', marginTop: space.xl },
});
