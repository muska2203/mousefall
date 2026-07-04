/**
 * Публичный API реестра тактических утилит ИИ.
 *
 * Ответственность:
 * - Экспортировать типы и функции, которые стратегии используют
 *   для превращения высокоуровневых решений в GameAction.
 *
 * Правила:
 * - Стратегии импортируют только из этого файла, не из внутренних
 *   модулей папки tactics.
 */

export type { AttackTarget, CloseCombatResult, MoveTowardResult } from './types';

export { findVisibleAttackTarget } from './targeting';

export { attackTarget, moveToward, closeCombat } from './movement';
