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

export type AIMode = 'idle' | 'alert' | 'chase' | 'return';

/**
 * Временное состояние, перекрывающее базовый FSM.
 * - prepared: есть подготовленное намерение на следующий ход
 *
 * Вычисляется на лету функцией getAIOverlay из источника правды
 * (preparedIntent) и не хранится в AIState,
 * чтобы избежать дублирования и рассинхронизации.
 */
export type AIOverlay = 'prepared';

/**
 * Runtime-состояние конечного автомата ИИ-врага.
 * strategy: 'hunter' | 'simple-boss'.
 */
export type AIState = {
  strategy: 'hunter' | 'simple-boss';

  /** Базовое состояние поведения (FSM) */
  mode: AIMode;

  /** Последняя известная позиция игрока (для погони). null — неизвестна. */
  targetX: number | null;
  targetY: number | null;

  /** Точка спавна: куда возвращаться в режиме return */
  homeX: number;
  homeY: number;

  /** Сколько ходов осталось в состоянии ALERT (осмотр перед погоней) */
  alertTurns: number;

  /** Подготовленное намерение AI: скилл, который будет выполнен в начале следующего хода */
  preparedIntent: {
    abilityId: string;
    fixedTargets: Position[];
  } | null;
};

/**
 * Type guard: сущность является врагом с AI-состоянием.
 */
export function isEnemyEntity(entity: { type: string; aiState?: unknown }): entity is EnemyEntity {
  return entity.type === 'enemy' && typeof (entity as { aiState?: unknown }).aiState === 'object';
}

/**
 * Вычисляет временное AI-состояние (overlay) из источника правды.
 * Не мутирует state и не хранит результат — вызывается в момент использования.
 *
 * Источник правды:
 * - aiState.preparedIntent → 'prepared'
 */
export function getAIOverlay(enemy: EnemyEntity): AIOverlay | null {
  if (enemy.aiState.preparedIntent) {
    return 'prepared';
  }
  return null;
}

/**
 * Создаёт дефолтное AI-состояние для указанной стратегии.
 * @throws Если strategyId неизвестен.
 */
export function createDefaultAIState(strategyId: string): AIState {
  switch (strategyId) {
    case 'hunter':
      return {
        strategy: 'hunter',
        mode: 'idle',
        targetX: null,
        targetY: null,
        homeX: 0,
        homeY: 0,
        alertTurns: 0,
        preparedIntent: null,
      };
    case 'simple-boss':
      return {
        strategy: 'simple-boss',
        mode: 'idle',
        targetX: null,
        targetY: null,
        homeX: 0,
        homeY: 0,
        alertTurns: 0,
        preparedIntent: null,
      };
    default:
      throw new Error(`Unknown AI strategy: ${strategyId}`);
  }
}
