import type {GameState, PlayerEntity} from '@simulation/types';
import {getItem} from '@content/registry';
import {ExecutionBuilder} from '@simulation/systems/actions/types';
import {executeIntent} from '@simulation/systems/intents/execute-intent';
import {createInventoryItem} from './inventory-factory';
import {getItemAbilityEntries} from './ability-grant';

/**
 * Создаёт стартовое снаряжение игрока и помещает его в инвентарь.
 *
 * Вызывается ТОЛЬКО из GameSimulation.createNewGame, где есть GameState.
 * Геометрия уровня остаётся seed-детерминированной, а вот ролл скиллов
 * предметов использует runtime random и не гарантирует повторяемость.
 * Экипировка и выдача скиллов происходят через стандартные интенты
 * EQUIP_ITEM и GRANT_ABILITY, чтобы правила предметов корректно попадали
 * в activeRules.
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
      slot = 'weapon';
    } else if (template.type === 'armor') {
      slot = 'armor';
    } else if (template.type === 'amulet') {
      slot = 'amulet';
    }

    if (!slot) {
      continue;
    }

    // Локальный builder для синтетического корневого события.
    // Сам builder не сохраняется — он нужен только как родитель для интентов.
    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'END_TURN', entityId: player.id },
    });

    executeIntent(
      state,
      {
        type: 'EQUIP_ITEM',
        entityId: player.id,
        itemInstanceId: item.instanceId,
        slot,
      },
      builder,
      builder.root,
    );

    for (const entry of getItemAbilityEntries(item)) {
      executeIntent(
        state,
        {
          type: 'GRANT_ABILITY',
          entityId: player.id,
          ability: {
            templateId: entry.templateId,
            source: 'equipment',
            sourceItemInstanceId: entry.sourceItemInstanceId,
            level: entry.level,
            currentCooldown: 0,
          },
        },
        builder,
        builder.root,
      );
    }
  }
}
