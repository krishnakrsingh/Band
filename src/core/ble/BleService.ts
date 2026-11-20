import {
  BleManager, Device, Characteristic, State, Subscription,
} from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { fromByteArray, toByteArray } from 'base64-js';
import { UUID, buildFrame } from './protocol';

type FrameListener = (frame: number[]) => void;

class H59Ble {
  private manager = new BleManager();
  private device: Device | null = null;
  private writeChar: Characteristic | null = null;
  private sppWriteChar: Characteristic | null = null;
  private notifySubs: Subscription[] = [];
  private listeners = new Set<FrameListener>();
  private queue: Array<() => Promise<void>> = [];
  private busy = false;
  private scanning = false;

  onFrame(listener: FrameListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Request all BLE permissions needed on Android 12+ / legacy. */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version < 23) return true;
    try {
      const perms: Array<any> = Platform.Version >= 31
        ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN!,
           PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT!]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!];
      const res = await PermissionsAndroid.requestMultiple(perms);
      return Object.values(res).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
    } catch { return false; }
  }

  async requireBluetooth(): Promise<boolean> {
    const state = await this.manager.state();
    return state === State.PoweredOn;
  }

  scan(onFound: (device: Device) => void, onError?: (e: string) => void, timeoutMs = 15000): void {
    if (this.scanning) return;
    this.scanning = true;
    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) { this.scanning = false; this.manager.stopDeviceScan(); onError?.(error.message); return; }
      if (!device) return;
      if ((device.name ?? '').toUpperCase().includes('H59')) {
        this.scanning = false;
        this.manager.stopDeviceScan();
        onFound(device);
      }
    });
    setTimeout(() => {
      if (this.scanning) { this.manager.stopDeviceScan(); this.scanning = false; onError?.('No H59 found'); }
    }, timeoutMs);
  }

  stopScan(): void { if (this.scanning) { this.manager.stopDeviceScan(); this.scanning = false; } }

  /** Connect directly to the known MAC — avoids scanning when the band is connected to another app. */
  async connectByMac(mac: string): Promise<Device> {
    // Try bonded/known device list first (most reliable on Android).
    try {
      const known = await this.manager.devices([mac]);
      if (known.length > 0) return known[0];
    } catch {}
    return this.manager.connectToDevice(mac, { autoConnect: false });
  }

  async connect(device: Device): Promise<void> {
    const connected = await device.connect({ autoConnect: false });
    const withMtu = await connected.requestMTU(247);
    const discovered = await withMtu.discoverAllServicesAndCharacteristics();
    const chars = await discovered.characteristicsForService(UUID.NUS_SERVICE);
    this.writeChar = chars.find(c => c.uuid.toLowerCase().includes('0002')) ?? chars[0] ?? null;
    this.notifySubs?.forEach(s => s.remove());
    this.notifySubs = [];
    // Subscribe to ALL notify characteristics — large-data responses may arrive
    // on the serial-port notify (de5bf729), not only NUS (6e400003).
    const allChars = await discovered.characteristicsForService(UUID.NUS_SERVICE);
    const sppChars = await discovered.characteristicsForService('de5bf728-d711-4e47-af26-65e3012a5dc7');
    const fee7Chars = await discovered.characteristicsForService('0000fee7-0000-1000-8000-00805f9b34fb');
    this.sppWriteChar = sppChars.find(c => c.uuid.toLowerCase().includes('72a')) ?? null;
    const notifys = [...allChars, ...sppChars, ...fee7Chars].filter(c =>
      c.isNotifiable || c.isIndicatable);
    for (const nc of notifys) {
      const sub = nc.monitor((error, ch) => {
        if (error || !ch?.value) return;
        const frame = Array.from(toByteArray(ch.value));
        this.listeners.forEach(l => l(frame));
      }, `h59-${nc.uuid}`);
      this.notifySubs.push(sub);
    }
    this.device = discovered;
  }

  /** Read FW/HW revision strings from GATT 0x180A (base64 → ASCII). */
  async readDeviceInfo(): Promise<{ hardware: string; firmware: string }> {
    const decode = (b64?: string | null) => {
      if (!b64) return '—';
      try {
        const bytes = toByteArray(b64);
        return String.fromCharCode(...Array.from(bytes)).replace(/\0+$/, '') || '—';
      } catch { return '—'; }
    };
    let hardware = '—', firmware = '—';
    try {
      const c = await this.device?.readCharacteristicForService(UUID.DEVICE_INFO, UUID.HW_REV);
      hardware = decode(c?.value);
    } catch {}
    try {
      const c = await this.device?.readCharacteristicForService(UUID.DEVICE_INFO, UUID.FW_REV);
      firmware = decode(c?.value);
    } catch {}
    return { hardware, firmware };
  }

  /** Mandatory init order: SetTime → DeviceSupport → health queries. */
  async initialize(): Promise<void> {
    const now = new Date();
    const y = now.getFullYear() % 100;
    const bcd = (v: number) => (((Math.floor(v / 10) << 4) | (v % 10)) & 0xff);
    await this.write(0x01, [bcd(y), bcd(now.getMonth() + 1), bcd(now.getDate()),
      bcd(now.getHours()), bcd(now.getMinutes()), bcd(now.getSeconds()), 0x01]);
    await this.wait(400);
    await this.write(0x3c, []);
  }

  write(opcode: number, subdata: number[] = []): Promise<void> {
    const frame = buildFrame(opcode, subdata);
    return this.writeRaw(frame);
  }

  /** Write a raw byte packet on NUS (for standard small commands). */
  writeRaw(bytes: number[]): Promise<void> {
    const b64 = fromByteArray(new Uint8Array(bytes));
    return this.enqueue(async () => {
      if (!this.writeChar) throw new Error('Not connected');
      await this.writeChar.writeWithResponse(b64);
    });
  }

  /** Large-data requests go to the SPP write characteristic, in 20-byte chunks. */
  writeLargeData(bytes: number[]): Promise<void> {
    const chunks: number[][] = [];
    for (let i = 0; i < bytes.length; i += 20) chunks.push(bytes.slice(i, i + 20));
    return this.enqueue(async () => {
      if (!this.sppWriteChar) throw new Error('SPP write char unavailable');
      for (const chunk of chunks) {
        await this.sppWriteChar.writeWithResponse(fromByteArray(new Uint8Array(chunk)));
        await this.wait(30);
      }
    });
  }

  startRawPpg(kind: 'green' | 'redir' = 'green'): Promise<void> {
    return kind === 'green'
      ? this.write(0x69, [0x0d, 0x0a, 0x00])
      : this.write(0x69, [0x0e, 0x0a, 0x00]);
  }
  stopRawPpg(): Promise<void> { return this.write(0x6a, [0x01, 0x0d, 0x00]); }
  startHr(): Promise<void> { return this.write(0x69, [0x01, 0x00]); }
  stopHr(): Promise<void> { return this.write(0x6a, [0x01, 0x01, 0x00]); }
  findBand(): Promise<void> { return this.write(0x50, [0x55, 0xaa]); }
  battery(): Promise<void> { return this.write(0x03, []); }

  async readRssi(): Promise<number> {
    try { return (await this.device?.readRSSI())?.rssi ?? 0; } catch { return 0; }
  }

  isConnected(): boolean { return this.device !== null && this.writeChar !== null; }

  /** Best-effort reconnect to the known band on app start (for notification haptics). */
  async restoreConnection(mac = '31:30:45:32:BA:06'): Promise<boolean> {
    try {
      const granted = await this.requestPermissions();
      if (!granted || !(await this.requireBluetooth())) return false;
      const d = await this.connectByMac(mac);
      await this.connect(d);
      return true;
    } catch { return false; }
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try { await job(); resolve(); } catch (e) { reject(e); }
      });
      this.pump();
    });
  }

  private async pump() {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      const job = this.queue.shift();
      if (job) await job();
      await this.wait(180); // spacing proven in the probe
    }
    this.busy = false;
  }

  private wait(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

  async disconnect(): Promise<void> {
    this.notifySubs.forEach(s => s.remove());
    this.notifySubs = [];
    const d = this.device;
    this.device = null;
    this.writeChar = null;
    try { if (d) await d.cancelConnection(); } catch {}
  }
}

export const ble = new H59Ble();
