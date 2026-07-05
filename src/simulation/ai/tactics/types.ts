/**
 * Базовые типы для тактических утилит ИИ.
 *
 * Ответственность:
 * - Определять абстракцию атакуемой цели, не привязанную к игроку.
 * - Описывать результаты тактических примитивов (движение, бой).
 *
 * Правила:
 * - Все типы JSON-сериализуемы, без функций.
 * - AttackTarget — минимальный интерфейс для любой сущности,
 *   которую ИИ может атаковать. Сейчас это только игрок,
 *   но в будущем может быть враг, спутник или ломаемый объект.
 */

import type { EntityId, Position, MoveAction, AttackAction, InteractAction } from '@simulation/core-types';
import type { Attackable } from '@simulation/types';

/**
 * Абстракция цели для атаки.
 *
 * Содержит только то, что нужно тактическим утилитам:
 * идентификатор, позицию и признаки живости/здоровья.
 */
export type AttackTarget = {
  id: EntityId;
} & Position &
  Attackable;

/**
 * Результат попытки подойти к цели вплотную и атаковать.
 *
 * - 'attack' — цель уже в соседней клетке, выдано действие ATTACK.
 * - 'move' — цель далеко, выдан один шаг MOVE по кратчайшему пути.
 * - 'blocked' — путь к цели отсутствует или цель недостижима.
 */
export type CloseCombatResult =
  | { kind: 'attack'; action: AttackAction }
  | { kind: 'move'; action: MoveAction }
  | { kind: 'interact'; action: InteractAction }
  | { kind: 'blocked' };

/**
 * Результат попытки сделать шаг к указанной позиции.
 *
 * - 'move' — найден следующий шаг, выдано действие MOVE.
 * - 'blocked' — путь к позиции отсутствует.
 */
export type MoveTowardResult =
  | { kind: 'move'; action: MoveAction }
  | { kind: 'interact'; action: InteractAction }
  | { kind: 'blocked' };
