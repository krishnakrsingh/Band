import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, stroke } from '../theme/tokens';
import { ble } from '../core/ble/BleService';
import { parseBattery, parseHr, parseHrRri, parsePpg } from '../core/ble/protocol';
import { useVitals } from '../core/store';
import { IconToday, IconLive, IconSleep, IconRecovery, IconDevice, IconProfile } from '../ui/icons';
import TodayScreen from '../features/today/TodayScreen';
import LiveScreen from '../features/live/LiveScreen';
import SleepScreen from '../features/sleep/SleepScreen';
import RecoveryScreen from '../features/recovery/RecoveryScreen';
import DeviceScreen from '../features/device/DeviceScreen';
import ProfileScreen from '../features/profile/ProfileScreen';
import AlarmScreen from '../features/alarms/AlarmScreen';
import CalendarScreen from '../features/calendar/CalendarScreen';
import { useAlarms } from '../features/alarms/AlarmStore';
import { loadSettings } from '../core/persistence';
import { useProfile } from '../core/profile';
import { startNotificationForwarding } from '../core/notifications/NotificationForwarder';
import NotificationDebugScreen from '../features/debug/NotificationDebugScreen';

type TabKey = 'Today' | 'Live' | 'Sleep' | 'Recovery' | 'Device' | 'Profile';

const TABS = [
  { key: 'Today' as const, Icon: IconToday },
  { key: 'Live' as const, Icon: IconLive },
  { key: 'Sleep' as const, Icon: IconSleep },
  { key: 'Recovery' as const, Icon: IconRecovery },
  { key: 'Device' as const, Icon: IconDevice },
  { key: 'Profile' as const, Icon: IconProfile },
];

const SCREENS: Record<Exclude<TabKey, 'Today'>, React.ComponentType> = {
  Live: LiveScreen, Sleep: SleepScreen,
  Recovery: RecoveryScreen, Device: DeviceScreen, Profile: ProfileScreen,
};

export default function RootNavigator() {
  const [tab, setTab] = useState<TabKey>('Today');
  const [showAlarms, setShowAlarms] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showNotifDebug, setShowNotifDebug] = useState(false);
  const setVitals = useVitals(s => s.setVitals);
  const pushPpg = useVitals(s => s.pushPpg);

  useEffect(() => {
    loadSettings().then(s => {
      useAlarms.getState().hydrate(s.alarms);
      useProfile.getState().setProfile(s.profile);
    });
    const stop = startNotificationForwarding();
    // Best-effort auto-reconnect on launch so notification haptics can fire
    // without the user manually opening Device → Connect first.
    ble.restoreConnection().then(ok => {
      if (ok) setVitals({ conn: 'connected' });
    });
    return stop;
  }, []);

  useEffect(() => ble.onFrame(frame => {
    const hr = parseHr(frame);
    if (hr != null) setVitals({ heartRate: hr });
    const rri = parseHrRri(frame);
    if (rri != null) setVitals({ rri });
    const bat = parseBattery(frame);
    if (bat) setVitals({ battery: bat.percent, charging: bat.charging });
    const payload = frame.length > 1 ? frame.slice(1) : frame;
    const ppg = parsePpg(frame);
    if (ppg) {
      // lead-off is the errCode at payload byte 1 (0=valid, 1=lead-off)
      const leadOff = payload[1] === 1;
      pushPpg(leadOff ? 0.5 : ppg.ppg / 65535);
      setVitals({
        onWrist: !leadOff,
        ...(ppg.heartRate ? { heartRate: ppg.heartRate } : {}),
        ...(ppg.spo2 ? { spo2: ppg.spo2 } : {}),
        ...(ppg.rri ? { rri: ppg.rri } : {}),
      });
    }
  }), [setVitals, pushPpg]);

  const Active = SCREENS[tab as Exclude<TabKey, 'Today'>];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content} key={tab}>
        {showAlarms ? (
          <AlarmScreen onBack={() => setShowAlarms(false)} />
        ) : showCalendar ? (
          <CalendarScreen onBack={() => setShowCalendar(false)} />
        ) : showNotifDebug ? (
          <NotificationDebugScreen onBack={() => setShowNotifDebug(false)} />
        ) : tab === 'Today' ? (
          <TodayScreen onGoDevice={() => setTab('Device')} />
        ) : tab === 'Device' ? (
          <DeviceScreen onGoAlarms={() => setShowAlarms(true)} onGoCalendar={() => setShowCalendar(true)}
            onGoNotificationDebug={() => setShowNotifDebug(true)} />
        ) : (
          <Active />
        )}
      </View>
      <View style={styles.tabBar}>
        {TABS.map(({ key, Icon }) => (
          <Pressable key={key} onPress={() => setTab(key)} style={styles.tab}
            accessibilityRole="button" accessibilityLabel={key}>
            <Icon color={key === tab ? colors.ink : colors.inkTertiary} />
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  tabBar: {
    height: 72, borderTopWidth: stroke.hairline, borderTopColor: colors.hairline,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  tab: { width: 56, height: 52, alignItems: 'center', justifyContent: 'center' },
});
