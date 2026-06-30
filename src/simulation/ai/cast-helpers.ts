import type { EnemyEntity, GameState } from '@simulation/types';
import { getAbility } from '@content/registry';
import { getSkillExecutor } from '@simulation/skills/skillExecutor';

/**
 * Возвращает скиллы, которые AI может подготовить на следующий ход.
 * Требования:
 * - кулдаун 0;
 * - шаблон существует и имеет флаг aiPreparable === true;
 * - стоимость способности не превышает максимальный запас AP актора;
 * - для способности зарегистрирован SkillExecutor.
 */
export function getPreparableAbilities(enemy: EnemyEntity, _state: GameState) {
  return enemy.abilities.filter((ability) => {
    if (ability.currentCooldown > 0) return false;
    const template = getAbility(ability.templateId);
    if (!template) return false;
    if (!template.aiPreparable) return false;
    if (!getSkillExecutor(ability.templateId)) return false;

    const apCost = template.apCost;
    // Способности со стоимостью 'all' не подходят для отложенного AI-исполнения:
    // их фактическая стоимость зависит от текущего AP в момент каста.
    if (apCost === 'all') return false;
    if (enemy.maxAp < apCost) return false;

    return true;
  });
}
