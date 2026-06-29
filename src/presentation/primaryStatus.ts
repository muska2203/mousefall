/**
 * Разрешение главного статуса сущности для отображения в UI.
 *
 * Ответственность:
 * - Определить, какой статус показывать над игровым объектом.
 * - Временный AI-overlay (stunned / casting / prepared) перекрывает базовый AI-режим.
 * - Для подготовленного скилла возвращает иконку самого скилла, а не общий маркер.
 *
 * Этот модуль живёт в Presentation, потому что результат — derived view data,
 * а не игровое состояние. Логика overlay берётся из simulation/ai/ai-state.ts,
 * чтобы не дублировать источник правды.
 */

import {getAIOverlay} from '@simulation/ai/ai-state';
import type {AIMode} from '@simulation/ai/ai-state';
import type {Entity} from '@simulation/types';

/** Статус "подготовка скилла": вместо текстового кода отображается иконка умения. */
export type PreparedStatus = {
  type: 'prepared';
  /** Путь к иконке подготовленного скилла (null — иконка не задана). */
  abilityIcon: string | null;
};

/** Главный статус, который может быть отображён над объектом. */
export type PrimaryStatus = AIMode | 'stunned' | 'casting' | PreparedStatus;

/**
 * Возвращает главный статус сущности.
 * - Для врагов: overlay (если есть), иначе текущий AI-режим.
 * - Для игрока: stunned или casting (overlay-эквиваленты), иначе null.
 * - Для прочих объектов: null.
 *
 * @param resolvePreparedIcon Опциональный резолвер пути к иконке подготовленного
 *   скилла. Без него prepared-статус вернётся с abilityIcon = null.
 */
export function resolvePrimaryStatus(
  entity: Entity,
  resolvePreparedIcon?: (abilityId: string) => string | null,
): PrimaryStatus | null {
  if (entity.type === 'enemy') {
    const overlay = getAIOverlay(entity);
    if (overlay === 'prepared') {
      const prepared = entity.aiState.preparedIntent!;
      return {
        type: 'prepared',
        abilityIcon: resolvePreparedIcon?.(prepared.abilityId) ?? null,
      };
    }
    return overlay ?? entity.aiState.mode;
  }

  if (entity.type === 'player') {
    if (entity.statusEffects.some((e) => e.type === 'stunned')) {
      return 'stunned';
    }
    if (entity.activeCast) {
      return 'casting';
    }
    return null;
  }

  return null;
}
