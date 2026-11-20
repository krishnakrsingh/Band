import { create } from 'zustand';
import type { GoogleSession } from './googleAuth';

type GState = {
  session: GoogleSession | null;
  setSession: (s: GoogleSession | null) => void;
};

export const useGoogle = create<GState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));
