import { StatusEffect } from '@simulation/types';

/**
 * Хелперы для работы с немотой (silenced).
 *
 * Немые акторы не могут использовать способности: USE_ABILITY отклоняется,
 * а AI не получает preparable-скиллов, пока статус активен.
 * При наложении немоты на врага с подготовленной способностью
 * подготовка сбрасывается.
 */

interface StatusHolder {
  statusEffects: Array<{ type: string }>;
}

function isStatusHolder(entity: unknown): entity is StatusHolder {
  return typeof entity === 'object' && entity !== null && 'statusEffects' in entity && Array.isArray((entity as StatusHolder).statusEffects);
}

/**
 * Проверяет, находится ли сущность под действием немоты.
 */
export function isSilenced(entity: unknown): boolean {
  return isStatusHolder(entity) && entity.statusEffects.some(e => e.type === 'silenced');
}
