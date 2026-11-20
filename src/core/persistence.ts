import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'h59.settings.v1';

export type PersistedSettings = {
  profile: { age: number; heightCm: number; weightKg: number; sex: 'male' | 'female' | 'other'; dailyStepGoal: number; restingHr: number };
  alarms: Array<{ id: number; enabled: boolean; hour: number; minute: number; weekMask: number; label: string }>;
  calendarEnabled: boolean;
};

export const defaultSettings: PersistedSettings = {
  profile: { age: 28, heightCm: 175, weightKg: 70, sex: 'other', dailyStepGoal: 8000, restingHr: 60 },
  alarms: [],
  calendarEnabled: false,
};

export async function loadSettings(): Promise<PersistedSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch { return defaultSettings; }
}

export async function saveSettings(s: PersistedSettings): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
