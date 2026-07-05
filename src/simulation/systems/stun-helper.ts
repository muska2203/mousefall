import { StatusEffect } from '@simulation/types';

/**
 * Хелперы для работы с оглушением (stunned).
 *
 * Оглушеённые акторы пропускают свой ход: любые действия, кроме END_TURN, запрещены,
 * а END_TURN при оглушении тикает stunned и сбрасывает оставшиеся AP.
 * Stunned не тикает через общий STATUS_TICK — он обрабатывается интентом
 * SKIP_STUNNED_TURN, чтобы гарантировать ровно один пропущенный ход при длительности 1.
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

