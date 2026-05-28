import type { EnemyEntity, GameState } from '@simulation/types';
import { getAbility } from '@content/registry';

/**
 * Возвращает скиллы с castTime > 0, которые враг может начать кастовать прямо сейчас.
 * Учитывает кулдаун и достаток MP.
 */
export function getCastableAbilities(enemy: EnemyEntity, _state: GameState) {
  return enemy.abilities.filter((ability) => {
    if (ability.currentCooldown > 0) return false;
    const template = getAbility(ability.templateId);
    if (!template) return false;
    if (template.castTime === 0) return false;
    return true;
  });
}
