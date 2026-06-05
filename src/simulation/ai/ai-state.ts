/**
 * Типы для состояния ИИ врага.
 *
 * Правила:
 * - Всё JSON-сериализуемо (plain object, никаких функций).
 * - Состояние хранится прямо в EnemyEntity.aiState для сохраняемости.
 * - Поле strategy — discriminant для будущей расширяемости ( discriminated union ).
 */

export type AIMode = 'idle' | 'alert' | 'chase' | 'return';

/**
 * Runtime-состояние конечного автомата ИИ-врага.
 * strategy: 'hunter' — единственная стратегия на данный момент.
 */
export type AIState = {
  strategy: 'hunter';

  /** Текущее состояние поведения */
  mode: AIMode;

  /** Последняя известная позиция игрока (для погони). null — неизвестна. */
  targetX: number | null;
  targetY: number | null;

  /** Точка спавна: куда возвращаться в режиме return */
  homeX: number;
  homeY: number;

  /** Сколько ходов осталось в состоянии ALERT (осмотр перед погоней) */
  alertTurns: number;
};

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
      };
    default:
      throw new Error(`Unknown AI strategy: ${strategyId}`);
  }
}
