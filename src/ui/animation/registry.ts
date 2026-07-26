/**
 * Реестр UI-исполнителей анимационных шагов.
 *
 * Каждый executor-файл в `src/ui/animation/` регистрирует свой экземпляр
 * при импорте (side-effect). `GameField` импортирует все executor-файлы
 * и получает готовый список из реестра, не дублируя его.
 */

import type {AnimationExecutor} from './types';

const executors: AnimationExecutor[] = [];

/** Зарегистрировать executor в глобальном списке UI-исполнителей. */
export function registerAnimationExecutor(executor: AnimationExecutor): void {
  executors.push(executor);
}

/** Получить все зарегистрированные executor'ы. */
export function getAnimationExecutors(): AnimationExecutor[] {
  return executors;
}
