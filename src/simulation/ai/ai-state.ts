/**
 * Типы для состояния ИИ врага.
 *
 * Правила:
 * - Всё JSON-сериализуемо (plain object, никаких функций).
 * - Состояние хранится прямо в EnemyEntity.aiState для сохраняемости.
 * - Поле strategy — discriminant для будущей расширяемости ( discriminated union ).
 */

import type { Position } from '@simulation/core-types';
import type { EnemyEntity } from '@simulation/types';


/**
 * Режимы ИИ врага.
 * - idle:    стоит на месте, сканирует окружение.
 * - chase:   движется к последней известной позиции игрока.
 * - return:  возвращается к точке спавна.
 * - prepared: есть подготовленное намерение на следующий ход.
 *
 * Режим 'prepared' не хранится в AIState напрямую — он выводится
 * из aiState.preparedAbility функцией getDerivedAIMode. Базовый FSM-режим
 * (idle/chase/return) сохраняется в aiState.mode, чтобы после
 * выполнения prepared-скилла враг мог продолжить прежнее поведение.
 */
export type AIMode = 'idle' | 'chase' | 'return' | 'prepared';

/**
 * Runtime-состояние конечного автомата ИИ-врага.
 * strategy: строковый ID из strategy-registry.
 */
export type AIState = {
  strategy: string;

  /** Базовое состояние поведения (FSM). Не теряется при подготовке скилла. */
  mode: Exclude<AIMode, 'prepared'>;

  /** Последняя известная позиция игрока (для погони). null — неизвестна. */
  targetX: number | null;
  targetY: number | null;

  /** Точка спавна: куда возвращаться в режиме return */
  homeX: number;
  homeY: number;

  /** Подготовленная способность AI: скилл и цели, которые будут использованы при следующем решении стратегии. */
  preparedAbility: {
    abilityId: string;
    targets: Position[];
  } | null;
};

/**
 * Type guard: сущность является врагом с AI-состоянием.
 */
export function isEnemyEntity(entity: { type: string; aiState?: unknown }): entity is EnemyEntity {
  return entity.type === 'enemy' && typeof (entity as { aiState?: unknown }).aiState === 'object';
}

/**
 * Возвращает производный AI-режим врага.
 * Если есть подготовленная способность (preparedAbility), режим считается 'prepared'.
 * Иначе используется базовый FSM-режим из aiState.mode.
 *
 * Это derived-значение: оно не хранится в AIState, чтобы избежать
 * дублирования источника правды и рассинхронизации.
 */
export function getDerivedAIMode(enemy: EnemyEntity): AIMode {
  if (enemy.aiState.preparedAbility) {
    return 'prepared';
  }
  return enemy.aiState.mode;
}

/**
 * Создаёт дефолтное AI-состояние для указанной стратегии.
 * @throws Если strategyId неизвестен.
 */
export function createDefaultAIState(strategyId: string, home?: Position): AIState {
  return {
    strategy: strategyId,
    mode: 'idle',
    targetX: null,
    targetY: null,
    homeX: home?.x ?? 0,
    homeY: home?.y ?? 0,
    preparedAbility: null,
  };
}
