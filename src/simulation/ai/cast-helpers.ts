import type { EnemyEntity, GameState } from '@simulation/types';
import { getAbility } from '@content/registry';

/**
 * Возвращает скиллы, которые AI может подготовить на следующий ход.
 * Требования: кулдаун 0, шаблон существует, флаг aiPreparable === true.
 */
export function getPreparableAbilities(enemy: EnemyEntity, _state: GameState) {
  return enemy.abilities.filter((ability) => {
    if (ability.currentCooldown > 0) return false;
    const template = getAbility(ability.templateId);
    if (!template) return false;
    if (!template.aiPreparable) return false;
    return true;
  });
}
