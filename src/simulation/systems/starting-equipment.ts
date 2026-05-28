import type { GameState, PlayerEntity } from '@simulation/types';
import { getItem } from '@content/registry';
import { createInventoryItem } from './inventory-factory';
import { addModifier } from './stats/modifier-engine';
import { recalculatePlayerBaseStats } from './stats/recalculate';

/**
 * Создаёт стартовое снаряжение игрока и помещает его в инвентарь.
 *
 * Вызывается ТОЛЬКО из GameSimulation.createNewGame, где есть GameState.
 * Детерминирован: использует state.rng и nextEntityId.
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

    if (slot && item.grantedAbility) {
      player.abilities.push({
        templateId: item.grantedAbility.templateId,
        source: 'equipment',
        sourceItemInstanceId: item.instanceId,
        level: item.grantedAbility.level,
        currentCooldown: 0,
      });
    }
  }

  recalculatePlayerBaseStats(player);
}
