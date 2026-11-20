/**
 * History sync orchestrator — bytecode-authoritative framing.
 * Commands: HR 0x15, HRV 0x39, Pressure 0x37, Steps 0x48.
 * Blood oxygen/sleep use 0xBC large-data transport (future work).
 */
import { ble } from '../ble/BleService';
import {
  resetHr, hrFrame, hrResult, resetSlots, slotFrame, slotResult, parseTodaySteps,
} from './assemblers';
import { useVitals } from '../store';

export type HistoryKind = 'hr' | 'hrv' | 'stress' | 'steps';

const CMD = { hr: 0x15, hrv: 0x39, stress: 0x37, steps: 0x48 } as const;

/** Day-start local unix seconds → 4 little-endian bytes (ReadHeartRateReq). */
function dayStartUtcPayload(dayOffset: number): number[] {
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  d.setHours(0, 0, 0, 0);
  const localStart = Math.floor(d.getTime() / 1000);
  const tz = -Math.round(d.getTimezoneOffset() * 60); // east-positive, SDK getOffset()/1000
  const secs = (localStart + tz) >>> 0; // commandDayStartUnixSeconds = zeroTime + tzOffset
  return [(secs >>> 0) & 0xff, (secs >>> 8) & 0xff, (secs >>> 16) & 0xff, (secs >>> 24) & 0xff];
}

class HistorySync {
  private off: (() => void) | null = null;
  private active: { kind: HistoryKind; resolve: (ok: boolean) => void } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private ensureListening() {
    if (this.off) return;
    this.off = ble.onFrame(frame => {
      if (!this.active) return;
      console.log('[H59SYNC]', this.active.kind, frame.map(b => b.toString(16).padStart(2, '0')).join(' '));
      const kind = this.active.kind;
      if (kind === 'steps') {
        if ((frame[0] & 0x7f) === 0x48) {
          const s = parseTodaySteps(frame);
          useVitals.getState().setVitals({
            steps: s.totalSteps, calories: s.calorie, distance: s.walkDistance,
          });
          this.finish(true);
        }
        return;
      }
      let final = false;
      if (kind === 'hr') final = hrFrame(frame);
      else { final = slotFrame(frame); }
      if (final) {
        this.applyResult(kind);
        this.finish(true);
      }
    });
  }

  private applyResult(kind: HistoryKind) {
    if (kind === 'hr') useVitals.getState().setVitals({ hrHistory: hrResult() });
    else if (kind === 'hrv') useVitals.getState().setVitals({ hrvHistory: slotResult() });
    else if (kind === 'stress') useVitals.getState().setVitals({ stressHistory: slotResult() });
  }

  private finish(ok: boolean) {
    if (!this.active) return;
    const { resolve } = this.active;
    if (this.timer) clearTimeout(this.timer);
    this.active = null;
    resolve(ok);
  }

  async sync(kind: HistoryKind, dayOffset = 0, timeoutMs = 15000): Promise<boolean> {
    this.ensureListening();
    if (kind === 'hr') resetHr();
    else if (kind === 'hrv' || kind === 'stress') resetSlots(kind);

    return new Promise<boolean>((resolve) => {
      this.active = { kind, resolve };
      this.timer = setTimeout(() => this.finish(false), timeoutMs);
      const payload = kind === 'hr' ? dayStartUtcPayload(dayOffset) :
        kind === 'steps' ? [] : [dayOffset & 0xff];
      ble.write(CMD[kind], payload).catch(() => this.finish(false));
    });
  }

  async syncAll(dayOffset = 0): Promise<void> {
    // Steps is a quick single-frame query; history uses multi-packet.
    for (const kind of ['steps', 'hr', 'hrv', 'stress'] as HistoryKind[]) {
      try { await this.sync(kind, dayOffset); } catch {}
      await new Promise(r => setTimeout(r, 350));
    }
  }

  stop() { if (this.off) { this.off(); this.off = null; } if (this.timer) clearTimeout(this.timer); }
}

export const historySync = new HistorySync();
