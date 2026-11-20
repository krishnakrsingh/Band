import { create } from 'zustand';

export type Profile = {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: 'male' | 'female' | 'other';
  dailyStepGoal: number;
  restingHr: number;
};

type PState = Profile & {
  setProfile: (p: Partial<Profile>) => void;
  maxHr: () => number;
};

const defaults: Profile = {
  age: 28, heightCm: 175, weightKg: 70, sex: 'other',
  dailyStepGoal: 8000, restingHr: 60,
};

export const useProfile = create<PState>((set, get) => ({
  ...defaults,
  setProfile: (p) => set(p),
  maxHr: () => 220 - get().age,
}));
