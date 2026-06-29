/**
 * Разрешение главного статуса сущности для отображения в UI.
 *
 * Ответственность:
 * - Определить AI-режим врага для иконки над объектом.
 * - Режим 'prepared' выводится из preparedIntent и перекрывает базовый FSM-режим.
 *   Иконка подготовленного скилла берётся отдельно из aiPreparedIntents во ViewModel.
 * - Для игрока и прочих объектов статус не отображается (null).
 *
 * Этот модуль живёт в Presentation, потому что результат — derived view data,
 * а не игровое состояние. Производный AI-режим берётся из simulation/ai/ai-state.ts,
 * чтобы не дублировать источник правды.
 */

import {getDerivedAIMode} from '@simulation/ai/ai-state';
import type {AIMode} from '@simulation/ai/ai-state';
import type {Entity} from '@simulation/types';

/** Главный статус, отображаемый над объектом. Сводится к чистому AI-режиму врага. */
export type PrimaryStatus = AIMode;

/**
 * Возвращает главный статус сущности.
 * - Для врагов: производный AI-режим (включая 'prepared' при наличии preparedIntent).
 * - Для игрока: null (статусы рисуются только в слотах активных эффектов).
 * - Для прочих объектов: null.
 */
export function resolvePrimaryStatus(entity: Entity): AIMode | null {
  if (entity.type === 'enemy') {
    return getDerivedAIMode(entity);
  }

  return null;
}
