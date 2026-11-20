import { create } from 'zustand';

/** One recorded decision/event in the notification → haptic chain. */
export type NotificationEvent = {
  seq: number;          // monotonic event number
  pattern: string | null;
  at: number;           // epoch ms
  result: string;       // human-readable outcome, e.g. "BAND OFFLINE", "BUZZ OK"
  skipped: boolean;     // true if the chain stopped before buzzing
  buzzed: boolean;      // true if a pulse train was actually attempted
};

const MAX_EVENTS = 10;

type NotificationState = {
  bridgePresent: boolean;       // native H59NotificationBridge module exists
  accessEnabled: boolean | null; // Android notification-access toggle (if queryable)
  eventCount: number;
  lastPattern: string | null;
  lastTime: number | null;
  lastError: string | null;
  lastSkippedReason: string | null;
  lastBuzzResult: string | null;
  events: NotificationEvent[];  // newest first, capped at 10
  recordEvent: (e: {
    pattern: string | null;
    at?: number;
    result: string;
    skipped?: boolean;
    buzzed?: boolean;
  }) => void;
  setBridgePresent: (v: boolean) => void;
  setAccessEnabled: (v: boolean | null) => void;
  setError: (e: string | null) => void;
  clear: () => void;
};

const initial = {
  bridgePresent: false,
  accessEnabled: null,
  eventCount: 0,
  lastPattern: null,
  lastTime: null,
  lastError: null,
  lastSkippedReason: null,
  lastBuzzResult: null,
  events: [] as NotificationEvent[],
};

/** Diagnostic store for the notification → band-haptic path. */
export const useNotificationStore = create<NotificationState>((set) => ({
  ...initial,

  recordEvent: ({ pattern, at, result, skipped = false, buzzed = false }) =>
    set((s) => {
      const seq = s.eventCount + 1;
      const when = at ?? Date.now();
      const event: NotificationEvent = { seq, pattern, at: when, result, skipped, buzzed };
      return {
        eventCount: seq,
        lastPattern: pattern,
        lastTime: when,
        lastSkippedReason: skipped ? result : null,
        lastBuzzResult: buzzed ? result : null,
        events: [event, ...s.events].slice(0, MAX_EVENTS),
      };
    }),

  setBridgePresent: (bridgePresent) => set({ bridgePresent }),
  setAccessEnabled: (accessEnabled) => set({ accessEnabled }),
  setError: (lastError) => set({ lastError }),
  clear: () => set({ ...initial, events: [] }),
}));
