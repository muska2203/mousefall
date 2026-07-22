/**
 * Анимационный композер для способности Rain.
 */

import type {AbilityEvent} from '../core/primitives';
import {abilityCastNode, particleBurstNode, projectileNode} from '../core/primitives';
import type {SkillComposer} from './registry';
import {registerSkillComposer} from './registry';

export const rainComposer: SkillComposer = (event: AbilityEvent, children) => {
  const target = event.targets[0];
  if (!target) {
    return [abilityCastNode(event, children)];
  }

  return [
    abilityCastNode(event, [
      projectileNode(event.from, target, [
        particleBurstNode(target, 0x4a90e2, 12, children),
      ]),
    ]),
  ];
};

registerSkillComposer('rain', rainComposer);
