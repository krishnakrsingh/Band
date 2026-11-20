# H59 Companion — pure React Native (no Expo)

Bare React Native 0.76.7 CLI app for the screenless H59 sensor pod.
Light-mode, monochrome, minimal-text UI. Feature-modular.

## Stack (zero Expo)
- React Native 0.76.7 (bare CLI)
- `react-native-ble-plx` — BLE (Nordic UART `6e40fff0`)
- `react-native-svg` — rings, sparklines, waveform, hypnogram
- `zustand` — state
- `react-native-safe-area-context` — safe areas
- Custom tab navigator (no React Navigation dependency)

## Structure
```
src/
  theme/tokens.ts          light monochrome tokens
  ui/                      Screen, Ring, Metric, Sparkline, icons
  core/
    ble/protocol.ts        wire protocol from LIVE captures (see ../WAR_ROOM.md §6)
    ble/BleService.ts      serialized GATT ops, direct-MAC connect, monitor-based notify
    ble/useConnection.ts   connect flow orchestrator
    sync/assemblers.ts     bytecode-authoritative multi-packet parsers (HR/HRV/Pressure/Steps)
    sync/HistorySync.ts    sequential history sync (0x15/0x39/0x37/0x48)
    sync/LargeData.ts      0xBC large-data transport (SpO2 0x2A / sleep 0x27) — experimental
    store.ts               vitals + history state
  navigation/RootNavigator.tsx
  features/{today,live,sleep,recovery,device}/
```

## History sync framing (see ../protocol_research.md)
`acceptData` receives `frame.slice(1, -1)` (opcode + CRC stripped, 14 bytes).
- HR 0x15: 13 values/packet, LE UTC anchor, 288 slots @ 5 min.
- HRV 0x39 / Pressure 0x37: 48 slots @ 30 min, auto word-mode (HRV only).
- Steps 0x48: single frame, 3-byte big-endian fields.
- SpO2/sleep: large-data action 0x2A/0x27 (0xBC header).

## Build
```powershell
npm install
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
cd android; .\gradlew.bat assembleRelease
adb install -r app\build\outputs\apk\release\app-release.apk
```

Standalone release APK — no Metro, no dev server.
