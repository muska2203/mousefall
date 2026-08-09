import type {GameState, InventoryItem} from '@simulation/types';
import {getItem} from '@content/registry';
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
