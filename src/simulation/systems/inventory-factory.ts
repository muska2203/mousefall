import type { GameState, InventoryItem } from '@simulation/types';
import { getItem } from '@content/registry';
import { nextEntityId } from '@simulation/state';
import { rollItemAbility } from './item-ability-roll';

/**
 * Фабрика создания экземпляра предмета в инвентаре.
 *
 * Генерирует уникальный instanceId через nextEntityId и роллит скилл из abilityPool.
 * Детерминирована благодаря seeded RNG в GameState.
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

  const rolled = rollItemAbility(template, state.rng);
  if (rolled) {
    grantedAbilities.push(rolled);
  }

  return {
    instanceId: nextEntityId(state, 'item'),
    templateId,
    quantity: 1,
    grantedAbilities,
  };
}
