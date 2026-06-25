/**
 * Builder для события CAST_RESOLVED.
 */

import type { GameEvent } from '@simulation/types';
import type { AnimationBuilder } from '../core/registry';
import { abilityCastNode } from '../core/primitives';
import { composeSkillAnimation } from '../skills/composer';

export const castResolvedBuilder: AnimationBuilder = (event, children, state) => {
  if (event.type !== 'CAST_RESOLVED') return null;

  const skillNodes = composeSkillAnimation(event.abilityId, event, children, state);
  if (skillNodes) return skillNodes;

  return [abilityCastNode(event, children)];
};
