/**
 * Буфер всплывающих уведомлений (Presentation Layer).
 *
 * Ответственность: накопление, удаление и ограничение количества
 * активных уведомлений. Не зависит от Simulation или UI.
 */

import { getDefaultToastDuration } from './toastBuilder';
import type { ToastItem, ToastKind } from './types';

/** Максимальное количество одновременно отображаемых уведомлений. */
const MAX_VISIBLE_TOASTS = 10;

export class ToastBuffer {
  private items: ToastItem[] = [];
  private nextId = 1;

  /**
   * Добавить новое уведомление.
   * При превышении лимита старые уведомления удаляются.
   */
  push(kind: ToastKind, title: string, message: string, duration?: number): void {
    if (duration === undefined) {
      duration = getDefaultToastDuration(kind);
    }
    const item: ToastItem = {
      id: String(this.nextId++),
      kind,
      title,
      message,
      duration,
    };

    this.items.push(item);

    if (this.items.length > MAX_VISIBLE_TOASTS) {
      this.items = this.items.slice(-MAX_VISIBLE_TOASTS);
    }
  }

  /** Удалить уведомление по идентификатору. */
  remove(id: string): void {
    this.items = this.items.filter((item) => item.id !== id);
  }

  /** Очистить все уведомления и сбросить счётчик. */
  clear(): void {
    this.items = [];
    this.nextId = 1;
  }

  /** Текущий список уведомлений. */
  get toasts(): ToastItem[] {
    return [...this.items];
  }
}
