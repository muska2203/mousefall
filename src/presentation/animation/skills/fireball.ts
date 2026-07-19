/**
 * Анимационный композер для способности Fireball.
 */

import type {AbilityEvent} from '../core/primitives';
import {abilityCastNode, explosionNode, projectileNode} from '../core/primitives';
import type {SkillComposer} from './registry';
import {registerSkillComposer} from './registry';

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
