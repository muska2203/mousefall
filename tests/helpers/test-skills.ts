/**
 * Тестовые SkillExecutor'ы, изолированные от реального контента.
 * Используются в юнит-тестах, чтобы не зависеть от production ability ID.
 */

import type {SkillExecutor} from '../../src/simulation/skills/skillExecutor';
import {fireballSkill} from '../../src/simulation/skills/executors/fireballSkill';

/**
 * Копия fireballSkill с отдельным ID для тестов AI-подготовки скиллов.
 * Реальный `fireball` не имеет флага `aiPreparable`, поэтому в тестах
 * используется этот изолированный executor.
 */
export const testFireballSkill: SkillExecutor = {
  ...fireballSkill,
  id: 'test-fireball',
};
