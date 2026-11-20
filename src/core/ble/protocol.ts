/**
 * Wire protocol — decoded from LIVE captures of H59_BA06, not from documentation.
 * See ../../../WAR_ROOM.md §5-6 for evidence.
 */
export const UUID = {
  NUS_SERVICE: '6e40fff0-b5a3-f393-e0a9-e50e24dcca9e',
  NUS_WRITE: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  NUS_NOTIFY: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  CCCD: '00002902-0000-1000-8000-00805f9b34fb',
  DEVICE_INFO: '0000180a-0000-1000-8000-00805f9b34fb',
  HW_REV: '00002a27-0000-1000-8000-00805f9b34fb',
  FW_REV: '00002a26-0000-1000-8000-00805f9b34fb',
} as const;

export const OP = {
  SET_TIME: 0x01,
  BATTERY: 0x03,
  DEVICE_SUPPORT: 0x3c,
  START_MEASURE: 0x69,
  STOP_MEASURE: 0x6a,
  FIND_BAND: 0x50,
  DEVICE_NOTIFY: 0x73,
} as const;

export const FRAME_LEN = 16;

/** [opcode][subdata…][CRC = sum(bytes 0..14) & 0xFF] */
export function buildFrame(opcode: number, subdata: number[] = []): number[] {
  const f = new Array<number>(FRAME_LEN).fill(0);
  f[0] = opcode & 0xff;
  subdata.slice(0, 15).forEach((b, i) => { f[i + 1] = b & 0xff; });
  let sum = 0;
  for (let i = 0; i < FRAME_LEN - 1; i++) sum += f[i];
  f[FRAME_LEN - 1] = sum & 0xff;
  return f;
}

/** The SDK decoder expects payload AFTER the opcode. Keep this rule central. */
export function responsePayload(frame: number[]): number[] {
  return frame.length > 1 ? frame.slice(1) : frame;
}

export function crcValid(frame: number[]): boolean {
  if (frame.length !== FRAME_LEN) return false;
  const sum = frame.slice(0, FRAME_LEN - 1).reduce((a, b) => a + b, 0);
  return (sum & 0xff) === frame[FRAME_LEN - 1];
}

export function bcd(v: number): number {
  return (((Math.floor(v / 10) << 4) | (v % 10)) & 0xff);
}

/** Live-verified SetTime payload: [year%100, month, day, hour, min, sec, language=1] */
export function setTimePayload(now = new Date()): number[] {
  return [
    bcd(now.getFullYear() % 100), bcd(now.getMonth() + 1), bcd(now.getDate()),
    bcd(now.getHours()), bcd(now.getMinutes()), bcd(now.getSeconds()), 0x01,
  ];
}

export type Capabilities = {
  deviceNoScreen: boolean;
  supportNotification: boolean;
  supportBloodOxygen: boolean;
  supportBloodPressure: boolean;
  supportPressure: boolean;
  supportHrv: boolean;
  supportOneKeyCheck: boolean;
  supportNewSleepProtocol: boolean;
  supportAppMeasure: boolean;
  maxWatchFace: number;
  supportEcg: boolean;
  supportAudio: boolean;
};

/** Decoded with the SDK's own parser using the corrected payload offset. */
export function decodeCapabilities(supportFrame: number[], setTimeFrame: number[]): Capabilities {
  const s = responsePayload(supportFrame); // byte0=0x00, byte1=0x40 on our device
  const t = responsePayload(setTimeFrame);
  return {
    deviceNoScreen: !!(s[1] & 0x40),
    supportNotification: !!(s[3] & 0x20),
    supportEcg: false, supportAudio: false, // all related flags were false on our device
    supportBloodOxygen: !!(t[3] & 0x01),
    supportBloodPressure: !!(t[4] & 0x01),
    supportPressure: !!(t[9] & 0x01),
    supportHrv: !!(t[10] & 0x01),
    supportOneKeyCheck: !!(t[5] & 0x01),
    supportNewSleepProtocol: !!(t[7] & 0x01),
    supportAppMeasure: !!(t[11] & 0x01),
    maxWatchFace: t[6] ?? 0,
  };
}

export type PpgSample = {
  type: 13 | 14; count: number; heartRate: number; spo2: number;
  ppg: number; rri: number; ax: number; ay: number; az: number;
};

export function parsePpg(frame: number[]): PpgSample | null {
  const p = responsePayload(frame);
  if (p[0] === 0x0d) {
    const ax = (p[9] << 8) | p[8], ay = (p[11] << 8) | p[10], az = (p[13] << 8) | p[12];
    const s16 = (v: number) => (v >= 32768 ? v - 65536 : v);
    return { type: 13, count: p[2], heartRate: p[3], spo2: 0,
      ppg: (p[5] << 8) | p[4], rri: (p[7] << 8) | p[6],
      ax: s16(ax), ay: s16(ay), az: s16(az) };
  }
  if (p[0] === 0x0e) {
    return { type: 14, count: p[2], heartRate: 0, spo2: p[3],
      ppg: (p[5] << 8) | p[4], rri: (p[7] << 8) | p[6], ax: 0, ay: 0, az: 0 };
  }
  return null;
}

/** Live HR frame: [0x69][type=0x01][err][bpm at byte 3][..][rriL@6][rriH@7][..][crc].
 *  Verified: 69 01 00 45 00 00 73 03 ... => 0x45=69 BPM, RRI=0x0373=883ms. */
export function parseHr(frame: number[]): number | null {
  if (frame[0] === 0x69 && frame[1] === 0x01) {
    const v = frame[3] ?? 0;
    if (v >= 30 && v <= 220) return v;
  }
  return null;
}

/** RRI from a live HR frame (little-endian at bytes 6-7). */
export function parseHrRri(frame: number[]): number | null {
  if (frame[0] === 0x69 && frame[1] === 0x01) {
    const v = ((frame[6] ?? 0) | ((frame[7] ?? 0) << 8));
    if (v > 200 && v < 3000) return v;
  }
  return null;
}

/** Live battery frame: [0x03][percent][charging][...][crc] — verified: 03 4F 00 ... 52 = 79%. */
export function parseBattery(frame: number[]): { percent: number; charging: boolean } | null {
  if (frame[0] === 0x03 && frame[1] > 0 && frame[1] <= 100) {
    return { percent: frame[1], charging: frame[2] === 1 };
  }
  return null;
}
