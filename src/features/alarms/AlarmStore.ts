import { create } from 'zustand';
import { ble } from '../../core/ble/BleService';

export type BandAlarm = {
  id: number;         // 0..4 (5 hardware slots)
  enabled: boolean;
  hour: number;
  minute: number;
  weekMask: number;   // bits 0-6 = Mon..Sun
  label: string;
};

type AState = {
  alarms: BandAlarm[];
  setAlarms: (a: BandAlarm[]) => void;
  upsert: (a: BandAlarm) => void;
  remove: (id: number) => void;
  pushToBand: (a: BandAlarm) => Promise<void>;
  hydrate: (a: BandAlarm[]) => void;
};

const bcd = (v: number) => (((Math.floor(v / 10) << 4) | (v % 10)) & 0xff);

export const useAlarms = create<AState>((set, get) => ({
  alarms: [],
  setAlarms: (alarms) => set({ alarms }),
  hydrate: (alarms) => set({ alarms }),
  upsert: (a) => set(s => {
    const next = [...s.alarms];
    const i = next.findIndex(x => x.id === a.id);
    if (i >= 0) next[i] = a; else next.push(a);
    return { alarms: next.sort((x, y) => x.id - y.id) };
  }),
  remove: (id) => set(s => ({ alarms: s.alarms.filter(a => a.id !== id) })),
  /** Real SDK format: [0x23][id][enable][BCD h][BCD m][7 weekday bytes] */
  pushToBand: async (a) => {
    const sub = [a.id, a.enabled ? 1 : 0, bcd(a.hour), bcd(a.minute)];
    for (let d = 0; d < 7; d++) sub.push((a.weekMask >> d) & 1);
    await ble.write(0x23, sub);
  },
}));
