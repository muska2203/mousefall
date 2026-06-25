/**
 * Анимационный композер для способности Swoop.
 */

import type { GameState } from '@simulation/types';
import type { AnimationNode } from '@presentation/types';
import type { AbilityEvent } from '../core/primitives';
import type { SkillComposer } from './registry';
import { registerSkillComposer } from './registry';
import { explosionNode, tileShakeNode } from '../core/primitives';

/** Строит специализированное дерево анимаций для Налёта.
 *
 * - Пропускает анимацию каста.
 * - Запускает прыжок кастера.
 * - После приземления параллельно запускаются:
 *   взрыв/удар по земле, тряска соседних тайлов, урон, отталкивание целей. */
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

  // Тряска соседних тайлов (8 клеток вокруг точки приземления).
  landingEffects.push(tileShakeNode(target, 1, []));

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
