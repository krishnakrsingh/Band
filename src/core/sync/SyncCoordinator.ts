/**
 * Multi-day catch-up sync. Pulls up to 7 days of history from the band's flash
 * and stores day-indexed records. Bytecode: BleOperateManager validates dayIndex 0..5.
 */
import { historySync } from './HistorySync';
import { useVitals, DayRecord } from '../store';

class SyncCoordinator {
  private running = false;

  async catchUp(days = 7, onProgress?: (done: number, total: number) => void): Promise<void> {
    if (this.running) return;
    this.running = true;
    const store = useVitals.getState();
    const records: DayRecord[] = [];
    const total = Math.min(days, 6); // firmware caps dayIndex at 5

    for (let day = 0; day < total; day++) {
      // Sync each metric for this day
      await historySync.sync('steps', day);
      await historySync.sync('hr', day);
      await historySync.sync('hrv', day);
      await historySync.sync('stress', day);

      const v = useVitals.getState();
      records.push({
        dayIndex: day,
        date: new Date(Date.now() - day * 86400000).toISOString().slice(0, 10),
        steps: v.steps,
        hrHistory: [...v.hrHistory],
        hrvHistory: [...v.hrvHistory],
        stressHistory: [...v.stressHistory],
      });
      onProgress?.(day + 1, total);
      await new Promise(r => setTimeout(r, 300));
    }
    useVitals.getState().setVitals({ days: records, syncing: false });
    this.running = false;
  }

  isRunning() { return this.running; }
}

export const syncCoordinator = new SyncCoordinator();
