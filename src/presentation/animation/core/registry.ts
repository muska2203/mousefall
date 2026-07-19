/**
 * Реестр animation builders.
 *
 * Ответственность:
 * - Хранение соответствия type GameEvent → AnimationBuilder.
 * - Публичная функция registerAnimationBuilder для расширения системы.
 */

import type {GameEvent, GameState} from '@simulation/types';
import type {AnimationNode} from '@presentation/types';

/** Функция, преобразующая GameEvent в дерево AnimationNode. */
export type AnimationBuilder = (
  event: GameEvent,
  childNodes: AnimationNode[],
  state: GameState,
) => AnimationNode[] | null;

const builders = new Map<string, AnimationBuilder>();

/** Зарегистрировать builder для конкретного типа GameEvent. */
export function registerAnimationBuilder(eventType: string, builder: AnimationBuilder): void {
  builders.set(eventType, builder);
}

/** Получить builder по типу события. */
export function getAnimationBuilder(eventType: string): AnimationBuilder | undefined {
  return builders.get(eventType);
}
