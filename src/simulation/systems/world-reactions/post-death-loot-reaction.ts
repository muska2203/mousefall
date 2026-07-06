/**
 * Реакция мира: выпадение лута при смерти врага.
 *
 * Подписана на ENTITY_DIED. Для врагов с lootTable рассчитывает
 * количество и содержимое дропа, возвращая SpawnItemIntent[].
 */

import { WorldReaction } from './types';
import { findEntity } from '@simulation/state';
import { tryGetEntity } from '@content/registry';
import { calculateLootDrops, rollLootDropCount } from '@utils/loot';

export const postDeathLootReaction: WorldReaction = (
    state,
    event,
    _builder,
    _parent,
) => {
    if (event.type !== 'ENTITY_DIED') return [];

    const entity = findEntity(state, event.entityId);
    if (!entity || entity.type !== 'enemy') return [];

    const template = tryGetEntity(entity.templateId);
    if (!template) return [];

    const lootTable = template.lootTable;
    if (!lootTable || lootTable.length === 0) return [];

    const count = rollLootDropCount(template.lootDropTable ?? []);

    const drops = calculateLootDrops(lootTable, count);

    return drops.map(templateId => ({
        type: 'SPAWN_ITEM' as const,
        templateId,
        position: event.position,
        sourceEntityId: event.entityId,
    }));
};
