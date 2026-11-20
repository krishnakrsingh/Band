/**
 * Multi-packet history assemblers — bytecode-authoritative.
 * acceptData() receives frame.slice(1, length-1) — opcode AND CRC stripped (14 bytes).
 * data[0] = packet index. 'final' when idx==size-1, 0xFF, or size==0.
 * See protocol_research.md for citations.
 */

const strip = (frame: number[]) => frame.slice(1, frame.length - 1);
const signed8 = (v: number) => (v << 24) >> 24;

/** SDK convention: getOffset()/1000, east-positive (+19800 for IST). */
function tzOffsetSeconds(utcSec: number): number {
  return -Math.round(new Date(utcSec * 1000).getTimezoneOffset() * 60);
}

/* ---------------- Heart rate 0x15 ---------------- */
type HrState = { size: number; index: number; range: number; utc: number; values: number[]; done: boolean };
const hr: HrState = { size: 0, index: 0, range: 5, utc: 0, values: [], done: false };
export function resetHr() { hr.size = 0; hr.index = 0; hr.range = 5; hr.utc = 0; hr.values = []; hr.done = false; }

export function hrFrame(frame: number[]): boolean {
  const d = strip(frame);
  const idx = d[0] & 0xff;
  const isToday = hr.utc > 0 && new Date(hr.utc * 1000).toDateString() === new Date().toDateString();
  if (idx === 0xff || (isToday && idx === 0x17)) { hr.done = true; return true; }
  if (idx === 0) {
    hr.size = signed8(d[1]); hr.range = signed8(d[2]);
    hr.values = new Array(Math.max(0, hr.size * 13)).fill(0);
    hr.index = 0; hr.utc = 0; hr.done = false;
    if (hr.size === 0) { hr.done = true; return true; }
    return false;
  }
  if (idx === 1) {
    const raw = ((d[1] & 0xff) | ((d[2] & 0xff) << 8) | ((d[3] & 0xff) << 16) | ((d[4] & 0xff) << 24)) >>> 0;
    hr.utc = (raw - tzOffsetSeconds(raw)) | 0;
    const dt = new Date(hr.utc * 1000);
    const slot = (hr.utc > 0 && hr.range > 0)
      ? Math.floor((dt.getHours() * 60 + dt.getMinutes()) / hr.range) : 0;
    for (let i = 5; i < d.length; i++) hr.values[slot + i - 5] = d[i] & 0xff;
    hr.index = slot + (d.length - 5);
    return false;
  }
  if ((frame[0] & 0x7f) === 0x15) {
    for (let i = 1; i < d.length; i++) hr.values[hr.index + i - 1] = d[i] & 0xff;
    hr.index += 13; // literal from bytecode
    if (idx === hr.size - 1) hr.done = true;
  }
  return hr.done;
}
export function hrResult(): number[] {
  const out = new Array(288).fill(0);
  hr.values.slice(0, 288).forEach((v, i) => { out[i] = v < 0 ? v + 256 : v; });
  // "Today" trailing slots beyond now are zeroed by firmware; we keep as received.
  return out;
}

/* ---------------- HRV 0x39 & Pressure 0x37 ---------------- */
type SlotState = {
  size: number; index: number; range: number; startInterval: number; offset: number;
  pendingLow: number; wordMode: boolean | null; out: number[]; done: boolean; kind: 'hrv' | 'stress';
};
const slot: SlotState = { size: 0, index: 0, range: 30, startInterval: 0, offset: -1, pendingLow: -1, wordMode: null, out: [], done: false, kind: 'hrv' };
export function resetSlots(kind: 'hrv' | 'stress') {
  slot.size = 0; slot.index = 0; slot.range = 30; slot.startInterval = 0; slot.offset = -1;
  slot.pendingLow = -1; slot.wordMode = null; slot.out = []; slot.done = false; slot.kind = kind;
}

function normalizeHrv(low: number, high: number) {
  const v = low | (high << 8);
  if (high === 0) return low;
  if (low === 0) return high;
  return v > 255 ? 0 : v;
}
function likelyWord(d: number[], s: number, n: number) {
  const pairs = Math.floor(n / 2);
  if (pairs <= 0) return false;
  let z = 0;
  for (let i = 0; i + 1 < n; i += 2) if (!d[s + i] || !d[s + i + 1]) z++;
  return z >= pairs - 1;
}
function writeSlot(v: number, stride: number) {
  const dst = slot.index * stride;
  if (dst < 288) { slot.out[dst] = v; slot.index++; }
}
function appendSlots(d: number[], src: number, count: number) {
  const stride = Math.max(1, Math.floor(slot.range / 5));
  if (slot.kind === 'stress') {
    // Pressure: no word mode, no normalization
    for (let i = 0; i < count; i++) writeSlot(d[src + i] & 0xff, stride);
    return;
  }
  if (slot.wordMode === null) slot.wordMode = likelyWord(d, src, count);
  if (!slot.wordMode) {
    for (let i = 0; i < count; i++) writeSlot(d[src + i] & 0xff, stride);
  } else {
    let i = src; const end = src + count;
    while (i < end) {
      const low = d[i] & 0xff;
      if (slot.pendingLow >= 0) {
        writeSlot(normalizeHrv(slot.pendingLow, low), stride);
        slot.pendingLow = -1; i++;
      } else if (i + 1 < end) {
        writeSlot(normalizeHrv(low, d[i + 1] & 0xff), stride); i += 2;
      } else { slot.pendingLow = low; i++; }
    }
  }
}

export function slotFrame(frame: number[]): boolean {
  const d = strip(frame);
  const idx = d[0] & 0xff;
  if (idx === 0xff) { slot.done = true; return true; }
  if (idx === 0) {
    slot.size = d[1] & 0xff;
    if (slot.kind === 'hrv' && d.length > 3) {
      slot.startInterval = signed8(d[3]);
      slot.range = slot.startInterval === 0 ? 60 : (d[2] & 0xff);
    } else {
      slot.startInterval = 0; slot.range = d[2] & 0xff;
    }
    slot.index = 0; slot.pendingLow = -1; slot.wordMode = null;
    slot.out = new Array(slot.size === 0 ? 0 : 288).fill(0);
    if (slot.size === 0) { slot.done = true; return true; }
    return false;
  }
  if (idx === 1) {
    slot.offset = signed8(d[1]);
    appendSlots(d, 2, d.length - 2);
    return false;
  }
  appendSlots(d, 1, d.length - 1);
  if (idx === slot.size - 1) slot.done = true;
  return slot.done;
}

/** Collapse the 288-stride array to non-zero 48-slot (or 24-slot) values. */
export function slotResult(): number[] {
  const stride = Math.max(1, Math.floor(slot.range / 5));
  const vals: number[] = [];
  for (let i = 0; i < 288; i += stride) {
    const v = slot.out[i];
    vals.push(v === undefined ? 0 : (v < 0 ? v + 256 : v));
  }
  return vals;
}

/* ---------------- Steps today 0x48 (single frame) ---------------- */
export function parseTodaySteps(frame: number[]) {
  const d = strip(frame);
  const be3 = (i: number) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
  return {
    totalSteps: be3(0),
    runningSteps: be3(3),
    calorie: be3(6),
    walkDistance: be3(9),
    sportDuration: (((d[12] << 8) | d[13]) * 60),
  };
}
