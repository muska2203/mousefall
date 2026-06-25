/**
 * Анимационный композер для способности Fireball.
 */

import type { GameState } from '@simulation/types';
import type { AnimationNode } from '@presentation/types';
import type { AbilityEvent } from '../core/primitives';
import type { SkillComposer } from './registry';
import { registerSkillComposer } from './registry';
import { abilityCastNode, projectileNode, explosionNode } from '../core/primitives';

export const fireballComposer: SkillComposer = (event: AbilityEvent, children) => {
  const target = event.targets[0];
  if (!target) {
    return [abilityCastNode(event, children)];
  }

  return [
    abilityCastNode(event, [
      projectileNode(event.from, target, [
        explosionNode(target, 1, children),
      ]),
    ]),
  ];
};

registerSkillComposer('fireball', fireballComposer);
