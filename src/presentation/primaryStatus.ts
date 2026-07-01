/**
 * Разрешение AI-режима сущности для отображения в UI.
 *
 * Ответственность:
 * - Определить AI-режим врага для иконки над объектом.
 * - Режим 'prepared' выводится из preparedAbility и перекрывает базовый FSM-режим.
 *   Иконка подготовленного скилла берётся отдельно из aiPreparedIntents во ViewModel.
 * - Для игрока и прочих объектов режим не отображается (null).
 *
 * Этот модуль живёт в Presentation, потому что результат — derived view data,
 * а не игровое состояние. Производный AI-режим берётся из simulation/ai/ai-state.ts,
 * чтобы не дублировать источник правды.
 */

import {getDerivedAIMode} from '@simulation/ai/ai-state';
import type {AIMode} from '@simulation/ai/ai-state';
import type {Entity} from '@simulation/types';

/**
 * Возвращает AI-режим сущности.
 * - Для врагов: производный AI-режим (включая 'prepared' при наличии preparedAbility).
 * - Для игрока: null (статусы рисуются только в слотах активных эффектов).
 * - Для прочих объектов: null.
 */
export function resolveAIMode(entity: Entity): AIMode | null {
  if (entity.type === 'enemy') {
    return getDerivedAIMode(entity);
  }

  return null;
}
