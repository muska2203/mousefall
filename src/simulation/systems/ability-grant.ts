/**
 * Утилиты для выдачи способностей предмета.
 *
 * Централизует логику превращения InventoryItem.grantedAbilities
 * в intents / runtime-записи. Используется при экипировке и стартовом снаряжении.
 */

import type { InventoryItem } from '@simulation/types';

/**
 * Возвращает плоский список всех способностей экземпляра предмета
 * в виде унифицированных записей (templateId + level + instanceId источника).
 */
export function getItemAbilityEntries(
  item: InventoryItem,
): Array<{ templateId: string; level: number; sourceItemInstanceId: string }> {
  return item.grantedAbilities.map((ability) => ({
    templateId: ability.templateId,
    level: ability.level,
    sourceItemInstanceId: item.instanceId,
  }));
}
