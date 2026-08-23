/**
 * Анимационный композер для способности Swoop.
 */

import type {AnimationNode} from '@presentation/types';
import {explosionNode} from '../core/primitives';
import type {SkillComposer} from './registry';
import {registerSkillComposer} from './registry';

/** Строит специализированное дерево анимаций для Налёта.
 *
 * - Пропускает анимацию каста.
 * - Запускает прыжок кастера.
 * - После приземления параллельно запускаются:
 *   взрыв/удар по земле, урон, отталкивание целей.
 *
 * Тряска зоны прилёта в композере не нужна: её добавляет планировщик
 * по событию TILES_AFFECTED (дочерний узел ABILITY_USED от интента TOUCH_TILES);
 * узел-тряска попадает в childNodes и уносится в landingEffects — после приземления
 * (см. PRESENTATION_CONTRACT §2.9). */
function buildSwoopAnimationNodes(
  casterId: string,
  targets: Array<{ x: number; y: number }>,
  childNodes: AnimationNode[],
): AnimationNode[] {
  const target = targets[0];
  if (!target) return childNodes;

  const casterJump = childNodes.find((n) => n.step.type === 'JUMP' && n.step.entityId === casterId);
  const effectNodes = childNodes.filter((n) => !(n.step.type === 'JUMP' && n.step.entityId === casterId));

  const landingEffects: AnimationNode[] = [];

  // Удар по земле — визуальный взрыв в точке приземления.
  landingEffects.push(explosionNode(target, 1, []));

  landingEffects.push(...effectNodes);

  if (!casterJump) {
    return landingEffects;
  }

  casterJump.children.push(...landingEffects);

  return [casterJump];
}

export const swoopComposer: SkillComposer = (event, children) => {
  return buildSwoopAnimationNodes(event.entityId, event.targets, children);
};

registerSkillComposer('swoop', swoopComposer);
// Босс-вариант Налёта использует ту же анимацию (телеграф зоны — generic).
registerSkillComposer('guardian_swoop', swoopComposer);
