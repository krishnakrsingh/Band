import { create } from 'zustand';

export type ConnState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

export type SleepStage = { t: number; d: number }; // t: 1=deep 2=light 3=awake 4=rem per SDK UI map

export type SleepSession = {
  dayIndex: number;
  stages: SleepStage[];
  totalMinutes: number;
  deepMinutes: number;
  lightMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
};

export type DayRecord = {
  dayIndex: number;
  date: string;
  steps: number;
  hrHistory: number[];
  hrvHistory: number[];
  stressHistory: number[];
};

export type Vitals = {
  heartRate: number;
  spo2: number;
  battery: number;
  charging: boolean;
  ppg: number[];
  rri: number;
  deviceName: string;
  firmware: string;
  hardware: string;
  rssi: number;
  // flow state
  conn: ConnState;
  connError: string;
  streaming: boolean; // raw PPG live
  hrStreaming: boolean;
  onWrist: boolean;
  // history
  hrHistory: number[];
  hrvHistory: number[];
  stressHistory: number[];
  spo2Min: number[];
  spo2Max: number[];
  steps: number;
  calories: number;
  distance: number;
  days: DayRecord[];
  sleepSessions: SleepSession[];
  syncing: boolean;
};

type State = Vitals & {
  setVitals: (patch: Partial<Vitals>) => void;
  pushPpg: (value: number) => void;
  reset: () => void;
};

/** Defaults are values captured live from H59_BA06 (see WAR_ROOM.md). */
const defaults: Vitals = {
  heartRate: 0,
  spo2: 0,
  battery: 0,
  charging: false,
  ppg: [],
  rri: 0,
  deviceName: 'H59',
  firmware: '—',
  hardware: '—',
  rssi: 0,
  conn: 'idle',
  connError: '',
  streaming: false,
  hrStreaming: false,
  onWrist: false,
  hrHistory: [],
  hrvHistory: [],
  stressHistory: [],
  spo2Min: [],
  spo2Max: [],
  steps: 0,
  calories: 0,
  distance: 0,
  days: [],
  sleepSessions: [],
  syncing: false,
};

export const useVitals = create<State>((set) => ({
  ...defaults,
  setVitals: (patch) => set(patch),
  pushPpg: (value) => set((s) => ({ ppg: [...s.ppg.slice(-119), value] })),
  reset: () => set({ ...defaults }),
}));
