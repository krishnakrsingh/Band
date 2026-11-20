import { useCallback } from 'react';
import { Device } from 'react-native-ble-plx';
import { ble } from './BleService';
import { useVitals } from '../store';

/** Orchestrates the full scan → connect → init → identify → buzz flow. */
export function useConnection() {
  const setVitals = useVitals(s => s.setVitals);
  const reset = useVitals(s => s.reset);

  const KNOWN_MAC = '31:30:45:32:BA:06';

  const finish = useCallback(async (device: Device) => {
    setVitals({ conn: 'connecting', deviceName: device.name ?? 'H59' });
    try {
      await ble.connect(device);
      await ble.initialize();
      const info = await ble.readDeviceInfo();
      const rssi = await ble.readRssi();
      setVitals({ conn: 'connected', hardware: info.hardware, firmware: info.firmware, rssi, hrStreaming: true });
      await ble.battery();
      await ble.startHr();  // continuous HR from the start
      await ble.findBand(); // physical confirmation buzz
    } catch (e: any) {
      setVitals({ conn: 'error', connError: e?.message ?? 'Connection failed' });
    }
  }, [setVitals]);

  const connect = useCallback(async () => {
    setVitals({ conn: 'scanning', connError: '' });
    const granted = await ble.requestPermissions();
    if (!granted) { setVitals({ conn: 'error', connError: 'Bluetooth permission denied' }); return; }
    if (!(await ble.requireBluetooth())) { setVitals({ conn: 'error', connError: 'Bluetooth is off' }); return; }

    // 1) Try direct MAC first — works even when the band isn't advertising.
    try {
      const device = await ble.connectByMac(KNOWN_MAC);
      await finish(device);
      return;
    } catch {}

    // 2) Fall back to scanning for any "H59" device.
    ble.scan(async (device) => { await finish(device); },
      (err) => setVitals({ conn: 'error', connError: err }));
  }, [setVitals, finish]);

  const disconnect = useCallback(async () => {
    await ble.disconnect();
    reset();
  }, [reset]);

  return { connect, disconnect };
}
