/**
 * Анимационный композер для способности Oil Flask.
 */

import type {AbilityEvent} from '../core/primitives';
import {abilityCastNode, particleBurstNode, projectileNode} from '../core/primitives';
import type {SkillComposer} from './registry';
import {registerSkillComposer} from './registry';

export const oilFlaskComposer: SkillComposer = (event: AbilityEvent, children) => {
  const target = event.targets[0];
  if (!target) {
    return [abilityCastNode(event, children)];
  }

  return [
    abilityCastNode(event, [
      projectileNode(event.from, target, [
        particleBurstNode(target, 0x5d4037, 12, children),
      ]),
    ]),
  ];
};

registerSkillComposer('oil_flask', oilFlaskComposer);
