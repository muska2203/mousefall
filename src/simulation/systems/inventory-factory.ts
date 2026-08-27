import type {GameState, InventoryItem, PlayerEntity} from '@simulation/types';
import {getItem, tryGetItem} from '@content/registry';
import {nextEntityId} from '@simulation/state';
import {rollItemAbility} from './item-ability-roll';
import {createItemAffixes} from './item-affix-roll';

/**
 * Фабрика создания экземпляра предмета в инвентаре.
 *
 * Генерирует уникальный instanceId через nextEntityId, роллит скилл из abilityPool
 * и собирает аффиксы: фирменные (fixedModifiers шаблона) + случайные из пула по подтипу.
 * Ролл скилла использует runtime random и не зависит от seed мира,
 * а ролл аффиксов идёт через seeded state.rng (детерминирован, воспроизводим).
 */
export function createInventoryItem(
  state: GameState,
  templateId: string,
): InventoryItem {
  const template = getItem(templateId);
  const grantedAbilities = (template.grantedAbilities ?? []).map((id) => ({
    templateId: id,
    level: 1,
  }));

  const rolled = rollItemAbility(template);
  if (rolled) {
    grantedAbilities.push(rolled);
  }

  return {
    instanceId: nextEntityId(state, 'item'),
    templateId,
    quantity: 1,
    grantedAbilities,
    affixes: createItemAffixes(state.rng, template),
  };
}

/**
 * Добавляет экземпляр предмета в инвентарь игрока со слиянием стопок.
 *
 * Стакаемый предмет (шаблон с `stackable: true`) доливается в неполные стеки
 * того же `templateId` по очереди (каждый до `maxStack`); не влезший остаток
 * кладётся новой ячейкой. Нестакаемые предметы всегда занимают новую ячейку.
 * Разделение стопок и частичный перенос — этап 2.3.
 *
 * Шаблон не найден (тесты без контентного реестра) — предмет считается нестакаемым.
 */
export function addItemToInventory(player: PlayerEntity, item: InventoryItem): void {
  const template = tryGetItem(item.templateId);
  if (template?.stackable) {
    let remaining = item.quantity;
    for (const stack of player.inventory) {
      if (stack.templateId !== item.templateId) {
        continue;
      }
      const moved = Math.min(template.maxStack - stack.quantity, remaining);
      if (moved <= 0) {
        continue;
      }
      stack.quantity += moved;
      remaining -= moved;
      if (remaining === 0) {
        break;
      }
    }
    item.quantity = remaining;
  }

  if (item.quantity > 0) {
    player.inventory.push(item);
  }
}
