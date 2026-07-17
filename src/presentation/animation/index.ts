/**
 * Точка входа для анимационного планировщика.
 *
 * Ответственность:
 * - Регистрация всех стандартных builders для GameEvent (через register.ts).
 * - Реэкспорт публичного API: buildAnimationTree, registerAnimationBuilder.
 */

import './register';

export { buildAnimationTree } from '../displayState/planner';
export { registerAnimationBuilder } from './core/registry';
