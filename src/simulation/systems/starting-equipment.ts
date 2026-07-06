import type { GameState, PlayerEntity } from '@simulation/types';
import { getItem } from '@content/registry';
import { createInventoryItem } from './inventory-factory';
import { addModifier } from './stats/modifier-engine';
import { recalculateActorStats } from './stats/recalculate';
import { getItemAbilityEntries } from './ability-grant';

/**
 * Создаёт стартовое снаряжение игрока и помещает его в инвентарь.
 *
 * Вызывается ТОЛЬКО из GameSimulation.createNewGame, где есть GameState.
 * Геометрия уровня остаётся seed-детерминированной, а вот ролл скиллов
 * предметов использует runtime random и не гарантирует повторяемость.
 * При авто-экипировке также добавляет скилл предмета и equipModifiers.
 */
export function createStartingEquipment(
  state: GameState,
  player: PlayerEntity,
  templateIds: string[],
): void {
  for (const templateId of templateIds) {
    const item = createInventoryItem(state, templateId);
    player.inventory.push(item);

    const template = getItem(templateId);
    let slot: 'weapon' | 'armor' | 'amulet' | null = null;
    if (template.type === 'weapon') {
      player.equippedWeaponId = templateId;
      player.equippedWeaponInstanceId = item.instanceId;
      slot = 'weapon';
    } else if (template.type === 'armor') {
      player.equippedArmorId = templateId;
      player.equippedArmorInstanceId = item.instanceId;
      slot = 'armor';
    } else if (template.type === 'amulet') {
      player.equippedAmuletId = templateId;
      player.equippedAmuletInstanceId = item.instanceId;
      slot = 'amulet';
    }

    // Применяем equipModifiers от предмета
    for (const mod of template.equipModifiers ?? []) {
      addModifier(player, { ...mod, source: `item_${item.instanceId}` });
    }

    if (slot) {
      for (const entry of getItemAbilityEntries(item)) {
        player.abilities.push({
          templateId: entry.templateId,
          source: 'equipment',
          sourceItemInstanceId: entry.sourceItemInstanceId,
          level: entry.level,
          currentCooldown: 0,
        });
      }
    }
  }

  recalculateActorStats(player);
}
