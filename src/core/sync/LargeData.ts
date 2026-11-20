/**
 * Large-data transport parser (0xBC magic framing) for sleep 0x27 and blood oxygen 0x2A.
 * Bytecode-authoritative — see protocol_research.md §5.4, §6.3.
 * Frame: [0xBC][action][u16LE len][u16LE crc][payload...]; first frame starts transfer,
 * subsequent frames are raw fragments appended until total-6 === len.
 */
import { ble } from '../ble/BleService';
import { useVitals } from '../store';

export type LargeAction = 0x27 | 0x3e | 0x2a;

/** CRC16 Modbus (init 0xFFFF, poly 0xA001) — matches SDK CRC16.calcCrc16. */
function crc16(data: number[]): number {
  let crc = 0xffff;
  for (const b of data) {
    crc ^= (b & 0xff);
    for (let i = 0; i < 8; i++) {
      crc = (crc & 1) ? ((crc >> 1) ^ 0xa001) : (crc >> 1);
    }
  }
  return crc & 0xffff;
}

class LargeData {
  private off: (() => void) | null = null;
  private collecting = false;
  private expectedLen = 0;
  private action: LargeAction | null = null;
  private buffer: number[] = [];
  private resolve: ((ok: boolean) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private ensureListening() {
    if (this.off) return;
    this.off = ble.onFrame(frame => this.onFrame(frame));
  }

  private wantedAction: LargeAction | null = null;

  private onFrame(frame: number[]) {
    if (!this.collecting) return;
    console.log('[H59LD-RAW]', frame.map(b => b.toString(16).padStart(2, '0')).join(' '));
    const isHeader = (frame[0] & 0xff) === 0xbc;
    if (isHeader) {
      const action = frame[1] as LargeAction;
      // Ignore companion frames (e.g. 0x3E nap header) that aren't the action we asked for.
      if (action !== this.wantedAction) {
        console.log('[H59LD] ignore action', action.toString(16), '(want', this.wantedAction?.toString(16), ')');
        return;
      }
      this.action = action;
      this.expectedLen = (frame[2] & 0xff) | ((frame[3] & 0xff) << 8);
      this.buffer = Array.from(frame);
      console.log('[H59LD] header action=', this.action?.toString(16), 'len=', this.expectedLen);
    } else {
      if (this.buffer.length === 0) return; // fragments before a header — skip
      for (const b of frame) this.buffer.push(b);
    }
    if (this.buffer.length - 6 >= this.expectedLen && this.expectedLen > 0) {
      this.finish(true);
    }
  }

  /** Request: write action with large-data payload, collect response blob.
   *  Sleep (0x27): SDK retries with single-byte payload if the 2-byte variant times out. */
  async collect(action: LargeAction, payload: number[], timeoutMs = 20000): Promise<boolean> {
    if (action === 0x27) {
      const first = await this.collectOnce(action, payload, 8000);
      if (first && this.buffer.length > 6) return true;
      // Fallback payload: single byte [days]
      return this.collectOnce(action, [payload[0]], timeoutMs);
    }
    return this.collectOnce(action, payload, timeoutMs);
  }

  private collectOnce(action: LargeAction, payload: number[], timeoutMs: number): Promise<boolean> {
    this.ensureListening();
    this.collecting = true;
    this.buffer = [];
    this.expectedLen = 0;
    this.wantedAction = action;
    return new Promise<boolean>((resolve) => {
      this.resolve = resolve;
      this.timer = setTimeout(() => this.finish(false), timeoutMs);
      // Exact SDK format: [0xBC][action][u16LE len][u16LE CRC16(payload)][payload]
      const c = crc16(payload);
      const req = [0xbc, action,
        payload.length & 0xff, (payload.length >> 8) & 0xff,
        c & 0xff, (c >> 8) & 0xff,
        ...payload];
      // pad to at least 16
      while (req.length < 16) req.push(0x00);
      ble.writeLargeData(req).catch(() => this.finish(false));
    });
  }

  private finish(ok: boolean) {
    if (this.timer) clearTimeout(this.timer);
    this.collecting = false;
    if (ok && this.buffer.length > 6) {
      if (this.action === 0x2a) this.parseBloodOxygen(this.buffer);
      else if (this.action === 0x27) this.parseSleep(this.buffer);
    }
    const r = this.resolve;
    this.resolve = null;
    r?.(ok);
  }

  /** Blood oxygen: 49-byte day records at blob+6; byte0=dayIndex, 24 interleaved [max,min]. */
  private parseBloodOxygen(blob: number[]) {
    const count = Math.min(Math.floor((blob.length - 6) / 49));
    const min: number[] = [], max: number[] = [];
    for (let day = 0; day < count; day++) {
      const rec = blob.slice(6 + day * 49, 6 + (day + 1) * 49);
      for (let j = 1; j <= 48; j++) {
        const v = rec[j] & 0xff;
        if (j % 2 === 1) max.push(v); else min.push(v);
      }
      break; // first day only for today view
    }
    useVitals.getState().setVitals({ spo2Min: min, spo2Max: max });
    console.log('[H59LD] SpO2 min=', min.length, 'max=', max.length);
  }

  /** Sleep 0x27 — parse day records into stage/duration arrays.
   *  Verified real blob: bc 27 [len] [crc] [totalDay][currDay][offset] ... stage/duration pairs.
   *  SDK stage codes: t=3 deep, t=2 light, t=5 awake, t=4 REM (t=1 also deep in some builds). */
  private parseSleep(blob: number[]) {
    if (blob.length < 7) return;
    const totalDay = blob[6] & 0xff;
    const sessions: import('../store').SleepSession[] = [];
    let pos = 7;
    for (let day = 0; day < totalDay && pos + 6 < blob.length; day++) {
      const dayIndex = blob[pos] & 0xff;
      // Stage/duration pairs begin at pos+6; use the whole remaining record region.
      // Record length is bounded by the next day marker (a byte == dayIndex-1) or blob end.
      let end = blob.length;
      for (let i = pos + 8; i < blob.length - 1; i++) {
        if ((blob[i] & 0xff) === (dayIndex > 0 ? dayIndex - 1 : 0xff) && (blob[i + 1] & 0xff) < 8) {
          end = i; break;
        }
      }
      const stages: import('../store').SleepStage[] = [];
      for (let i = pos + 6; i + 1 < end; i += 2) {
        const rawT = blob[i] & 0xff;
        const d = blob[i + 1] & 0xff;
        if (rawT < 1 || rawT > 5 || d === 0 || d > 600) continue;
        // map firmware raw type -> SDK UI type: 3->deep(1), 2->light(2), 5->awake(3), 4->rem(4), 1->deep(1)
        const t = rawT === 3 ? 1 : rawT === 2 ? 2 : rawT === 5 ? 3 : rawT === 4 ? 4 : 1;
        // merge adjacent same-stage
        const last = stages[stages.length - 1];
        if (last && last.t === t) last.d += d; else stages.push({ t, d });
      }
      if (stages.length) {
        const sum = (type: number) => stages.filter(s => s.t === type).reduce((a, s) => a + s.d, 0);
        sessions.push({
          dayIndex, stages,
          totalMinutes: stages.reduce((a, s) => a + s.d, 0),
          deepMinutes: sum(1), lightMinutes: sum(2), remMinutes: sum(4), awakeMinutes: sum(3),
        });
      }
      pos = end;
    }
    useVitals.getState().setVitals({ sleepSessions: sessions });
    console.log('[H59LD] sleep sessions=', sessions.length,
      sessions[0] ? JSON.stringify(sessions[0].stages) : 'none');
  }

  stop() { this.collecting = false; if (this.off) { this.off(); this.off = null; } if (this.timer) clearTimeout(this.timer); }
}

export const largeData = new LargeData();
