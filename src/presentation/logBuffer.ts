/**
 * Буфер combat-лога (Presentation Layer).
 *
 * Ответственность: накопление, очистка и форматирование записей лога.
 * Не зависит от Simulation или UI.
 */

import type { GameEvent, GameState } from '@simulation/types';
import { gameEventToLog } from './logBuilder';

export type LogItem = {
  id: number;
  text: string;
  variant?: 'loot' | 'good' | 'bad' | 'info';
};

export class LogBuffer {
  logs: LogItem[] = [];
  private nextLogId = 1;

  append(state: GameState, events: GameEvent[]): void {
    for (const event of events) {
      const entry = gameEventToLog(state, event);
      if (entry) {
        this.logs.push({ id: this.nextLogId++, text: entry.text, variant: entry.variant });
      }
    }
  }

  clear(): void {
    this.logs = [];
    this.nextLogId = 1;
  }
}
