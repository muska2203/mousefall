/**
 * Обработчик действия EQUIP — экипировка предмета из инвентаря.
 *
 * Логика:
 * - Проверяет, что предмет есть в инвентаре.
 * - Определяет слот по типу предмета (weapon/armor/amulet).
 * - Если слот занят — сначала порождает UNEQUIP_ITEM + REVOKE_ABILITY для старого предмета.
 * - Порождает EQUIP_ITEM и GRANT_ABILITY (если у предмета есть скилл).
 */

import { GameState } from "@simulation/types.ts";
import { getItem } from "@content/registry";
import { ActionHandler, ExecutionBuilder, ExecutionNode } from "@simulation/systems/actions/types.ts";
import { Intent } from "@simulation/systems/intents/types.ts";
import { executeIntent } from "@simulation/systems/intents/execute-intent.ts";
import { getItemAbilityEntries } from "@simulation/systems/ability-grant.ts";

export const equipEntity: ActionHandler = {

  validate(state: GameState, action) {
    if (action.type !== 'EQUIP') {
      return { ok: false, reasonCode: 'wrong_action_type', reasonDescription: 'Expected EQUIP action' };
    }

    const player = state.player;
    const item = player.inventory.find(i => i.instanceId === action.itemInstanceId);
    if (!item) {
      return { ok: false, reasonCode: 'item_not_found', reasonDescription: 'Предмет не найден в инвентаре' };
    }

    const template = getItem(item.templateId);
    let slot: 'weapon' | 'armor' | 'amulet' | null = null;
    if (template.type === 'weapon') slot = 'weapon';
    else if (template.type === 'armor') slot = 'armor';
    else if (template.type === 'amulet') slot = 'amulet';

    if (!slot) {
      return { ok: false, reasonCode: 'not_equippable', reasonDescription: 'Предмет нельзя экипировать' };
    }

    return { ok: true };
  },

  resolve(state: GameState, action) {
    if (action.type !== 'EQUIP') {
      return [];
    }

    const player = state.player;
    const item = player.inventory.find(i => i.instanceId === action.itemInstanceId)!;
    const template = getItem(item.templateId);
    const slot = template.type === 'weapon' ? 'weapon'
      : template.type === 'armor' ? 'armor'
      : 'amulet';

    const equippedId = slot === 'weapon' ? player.equippedWeaponInstanceId
      : slot === 'armor' ? player.equippedArmorInstanceId
      : player.equippedAmuletInstanceId;

    const intents: Intent[] = [];

    if (equippedId) {
      intents.push(
        { type: 'UNEQUIP_ITEM', entityId: action.entityId, slot },
        { type: 'REVOKE_ABILITY', entityId: action.entityId, sourceItemInstanceId: equippedId },
      );
    }

    intents.push(
      { type: 'EQUIP_ITEM', entityId: action.entityId, itemInstanceId: action.itemInstanceId, slot },
    );

    for (const entry of getItemAbilityEntries(item)) {
      intents.push({
        type: 'GRANT_ABILITY',
        entityId: action.entityId,
        ability: {
          templateId: entry.templateId,
          source: 'equipment',
          sourceItemInstanceId: entry.sourceItemInstanceId,
          level: entry.level,
          currentCooldown: 0,
        },
      });
    }

    return intents;
  },

  execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};
