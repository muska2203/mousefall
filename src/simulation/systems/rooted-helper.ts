/**
 * Хелперы для работы со статусом «Обездвижен» (rooted).
 *
 * Носитель rooted не может перемещаться самостоятельно: MOVE, рывок (dash)
 * и прыжок (swoop) запрещены. Атаки и способности по целям в досягаемости
 * разрешены. Внешние перемещения (PUSH) не блокируются — жертву можно
 * выбить из мышеловки толчком (концепт этажа 1, §2).
 *
 * В отличие от stunned/bulwark, rooted не запрещает действия в целом,
 * поэтому в canActorAct не участвует и тикает через общий TICK_STATUS_EFFECTS.
 */

interface StatusHolder {
  statusEffects: Array<{ type: string }>;
}

function isStatusHolder(entity: unknown): entity is StatusHolder {
  return typeof entity === 'object' && entity !== null && 'statusEffects' in entity && Array.isArray((entity as StatusHolder).statusEffects);
}

/**
 * Проверяет, обездвижена ли сущность.
 */
export function isRooted(entity: unknown): boolean {
  return isStatusHolder(entity) && entity.statusEffects.some(e => e.type === 'rooted');
}
