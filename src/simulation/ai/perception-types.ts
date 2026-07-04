/**
 * Типы для восприятия изменений мира AI-стратегиями.
 *
 * Правила:
 * - WorldChange описывает факт изменения мира, а не решение стратегии.
 * - Стратегия сама решает, реагировать ли на изменение, проверяя видимость/LOS.
 */

import type { WorldChange } from '@simulation/core-types';

export type { WorldChange } from '@simulation/core-types';

/**
 * Возвращает позицию, ассоциированную с изменением мира.
 * Используется для грубой фильтрации по расстоянию перед вызовом стратегии.
 */
export function getWorldChangePosition(change: WorldChange): { x: number; y: number } {
  switch (change.kind) {
    case 'entity_moved':
      return change.to;
    case 'door_opened':
    case 'door_closed':
      return change.position;
  }
}
