import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { ble } from '../ble/BleService';
import { useNotificationStore } from './notificationStore';

/** Shape of the optional native bridge. `emitTestPattern` may not exist yet. */
export type NotificationBridge = {
  isAccessEnabled: () => Promise<boolean>;
  openAccessSettings: () => void;
  isDndActive: () => Promise<boolean>;
  emitTestPattern?: (pattern: string) => void;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

const Bridge = NativeModules.H59NotificationBridge as NotificationBridge | undefined;
/** Exported so the Device tab / debug screen can call openAccessSettings(). */
export const notificationBridge = Bridge;

/** Only opcode 0x50 (find-band buzz) is live-verified. Patterns = pulse trains. */
export type PatternDef = { pulses: number; gapMs: number; repeats?: number };
export const PATTERNS: Record<string, PatternDef> = {
  call: { pulses: 4, gapMs: 260, repeats: 2 }, // long / urgent
  whatsapp: { pulses: 2, gapMs: 220 },          // double
  sms: { pulses: 3, gapMs: 220 },               // triple
};

const DEBOUNCE_MS = 1500;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

let lastBuzz = 0;
let activeUnsub: (() => void) | null = null;

/** Record a decision in the diagnostic store so the UI can explain a silent band. */
function logEvent(
  pattern: string | null,
  result: string,
  flags: { skipped?: boolean; buzzed?: boolean; at?: number } = {},
): void {
  useNotificationStore.getState().recordEvent({
    pattern,
    at: flags.at,
    result,
    skipped: flags.skipped ?? false,
    buzzed: flags.buzzed ?? false,
  });
  console.log('[H59NotifyJS]', pattern, result, 'connected=', ble.isConnected());
}

/** Run the actual find-band() pulse train. Throws if the band disconnects mid-train. */
async function runPulseTrain(p: PatternDef): Promise<void> {
  const repeats = p.repeats ?? 1;
  for (let r = 0; r < repeats; r++) {
    for (let i = 0; i < p.pulses; i++) {
      await ble.findBand();
      if (i < p.pulses - 1) await sleep(p.gapMs);
    }
    if (r < repeats - 1) await sleep(700);
  }
}

/** One delivery decision: every branch is logged, including all skips. */
async function deliver(
  pattern: string,
  opts: { source: 'event' | 'test'; ignoreDebounce?: boolean; at?: number },
): Promise<void> {
  const at = opts.at ?? Date.now();
  const now = Date.now();
  const def = PATTERNS[pattern];
  const prefix = opts.source === 'test' ? 'TEST ' : '';

  if (!def) {
    logEvent(pattern, 'NO PATTERN', { skipped: true, at });
    return;
  }
  if (!ble.isConnected()) {
    logEvent(pattern, 'BAND OFFLINE', { skipped: true, at });
    return;
  }
  if (!opts.ignoreDebounce && now - lastBuzz < DEBOUNCE_MS) {
    logEvent(pattern, `DEBOUNCE (${DEBOUNCE_MS - (now - lastBuzz)}ms)`, { skipped: true, at });
    return;
  }

  lastBuzz = now;
  try {
    await runPulseTrain(def);
    logEvent(pattern, `${prefix}BUZZ OK`, { buzzed: true, at });
  } catch (e) {
    const msg = errMsg(e);
    useNotificationStore.getState().setError(msg);
    logEvent(pattern, `${prefix}BUZZ FAILED: ${msg}`, { buzzed: true, at });
  }
}

/** Re-check native bridge presence and the Android notification-access toggle. */
export async function refreshNotificationStatus(): Promise<void> {
  const s = useNotificationStore.getState();
  const present = Platform.OS === 'android' && !!Bridge;
  s.setBridgePresent(present);
  if (Bridge && typeof Bridge.isAccessEnabled === 'function') {
    try {
      s.setAccessEnabled(await Bridge.isAccessEnabled());
    } catch (e) {
      s.setError(errMsg(e));
    }
  } else {
    s.setAccessEnabled(null);
  }
}

/**
 * Start listening for native notification-pattern events and buzz the band.
 * Returns an unsubscribe function. Safe to call again (replaces the old listener).
 */
export function startNotificationForwarding(): () => void {
  activeUnsub?.();
  const store = useNotificationStore.getState();

  if (Platform.OS !== 'android' || !Bridge) {
    store.setBridgePresent(false);
    logEvent(null, 'BRIDGE MISSING', { skipped: true });
    return () => {};
  }

  store.setBridgePresent(true);
  void refreshNotificationStatus();

  let emitter: NativeEventEmitter;
  try {
    // NativeEventEmitter tolerates a module without addListener/removeListeners,
    // but we still guard construction in case the bridge is malformed.
    emitter = new NativeEventEmitter(Bridge as any);
  } catch (e) {
    const msg = errMsg(e);
    store.setError(msg);
    logEvent(null, `EMITTER ERROR: ${msg}`, { skipped: true });
    return () => {};
  }

  if (typeof emitter.addListener !== 'function') {
    logEvent(null, 'ADD LISTENER MISSING', { skipped: true });
    return () => {};
  }

  let sub: { remove?: () => void };
  try {
    sub = emitter.addListener(
      'H59Notification',
      (payload: { pattern?: string; at?: number } | undefined) => {
        const pattern = typeof payload?.pattern === 'string' ? payload.pattern : '';
        const at = typeof payload?.at === 'number' ? payload.at : Date.now();
        void deliver(pattern, { source: 'event', at });
      },
    );
  } catch (e) {
    const msg = errMsg(e);
    store.setError(msg);
    logEvent(null, `SUBSCRIBE FAILED: ${msg}`, { skipped: true });
    return () => {};
  }

  const unsub = () => {
    try {
      sub?.remove?.();
    } catch {
      // Listener may already be gone (e.g. native reload) — nothing to do.
    }
    if (activeUnsub === unsub) activeUnsub = null;
  };
  activeUnsub = unsub;
  return unsub;
}

/**
 * Test the whole chain from a button. If the native `emitTestPattern` method
 * exists, let it emit a normal H59Notification event (the live listener then
 * logs and buzzes it). Otherwise run the JS → BLE pulse train directly.
 */
export async function triggerTestBuzz(pattern: string): Promise<void> {
  const at = Date.now();
  const emit = Bridge?.emitTestPattern;
  if (typeof emit === 'function') {
    try {
      emit.call(Bridge, pattern);
      logEvent(pattern, 'TEST NATIVE EMIT', { at });
    } catch (e) {
      const msg = errMsg(e);
      useNotificationStore.getState().setError(msg);
      logEvent(pattern, `TEST EMIT FAILED: ${msg}`, { skipped: true, at });
    }
    return;
  }

  // Native test hook not available yet — exercise the JS → BLE half directly,
  // bypassing the debounce so the button always produces a real buzz attempt.
  await deliver(pattern, { source: 'test', ignoreDebounce: true, at });
}
