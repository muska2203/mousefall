import { GameState, StatusEffect } from '@simulation/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findEntity } from '@simulation/state';

/**
 * Хелперы для работы с оглушением (stunned).
 *
 * Оглушеённые акторы пропускают свой ход: любые действия, кроме WAIT, запрещены,
 а WAIT при оглушении только сбрасывает оставшиеся AP и тикает stunned.
 * Stunned не тикает через общий STATUS_TICK — он обрабатывается здесь, чтобы
 * гарантировать ровно один пропущенный ход при длительности 1.
 */

interface StatusHolder {
  statusEffects: Array<{ type: string }>;
}

function isStatusHolder(entity: unknown): entity is StatusHolder {
  return typeof entity === 'object' && entity !== null && 'statusEffects' in entity && Array.isArray((entity as StatusHolder).statusEffects);
}

/**
 * Проверяет, оглушена ли сущность.
 */
export function isStunned(entity: unknown): boolean {
  return isStatusHolder(entity) && entity.statusEffects.some(e => e.type === 'stunned');
}

/**
 * Обрабатывает пропуск хода оглушённым актором:
 * - уменьшает длительность stunned на 1,
 * - удаляет эффект, если длительность стала 0,
 * - обнуляет AP актора,
 * - добавляет события в дерево выполнения.
 *
 * Возвращает последний созданный узел или null, если актор не был оглушён.
 */
export function skipStunnedActorTurn(
  state: GameState,
  entityId: string,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): ExecutionNode | null {
  const entity = findEntity(state, entityId);
  if (!entity || !('statusEffects' in entity) || !('ap' in entity)) return null;

  const holder = entity as unknown as { statusEffects: StatusEffect[]; ap: number };
  const index = holder.statusEffects.findIndex(e => e.type === 'stunned');
  if (index < 0) return null;

  const effect = holder.statusEffects[index]!;
  effect.duration -= 1;

  const tickNode = builder.addChild(parent, {
    type: 'STATUS_TICKED',
    entityId,
  });

  if (effect.duration <= 0) {
    holder.statusEffects.splice(index, 1);
    builder.addChild(tickNode, {
      type: 'STATUS_REMOVED',
      entityId,
      effectType: 'stunned',
    });
  }

  holder.ap = 0;

  return tickNode;
}
