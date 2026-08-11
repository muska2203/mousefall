/**
 * Хелперы для работы со статусом «Глухая оборона» (bulwark).
 *
 * Носитель bulwark неуязвим к урону и толчкам и не может совершать действия,
 * кроме END_TURN. Ключевое отличие от stunned: подготовленный скилл не сбрасывается
 * и ход не пропускается (нет SKIP_STUNNED_TURN). Статусы на носителя накладываются
 * как обычно — это сохраняет контрплей срыва подготовки.
 */

interface StatusHolder {
  statusEffects: Array<{ type: string }>;
}

function isStatusHolder(entity: unknown): entity is StatusHolder {
  return typeof entity === 'object' && entity !== null && 'statusEffects' in entity && Array.isArray((entity as StatusHolder).statusEffects);
}

/**
 * Проверяет, находится ли сущность под «Глухой обороной».
 */
export function isBulwarked(entity: unknown): boolean {
  return isStatusHolder(entity) && entity.statusEffects.some(e => e.type === 'bulwark');
}
