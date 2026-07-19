/**
 * Builder для события ABILITY_USED.
 */

import type {AnimationBuilder} from '../core/registry';
import {abilityCastNode} from '../core/primitives';
import {composeSkillAnimation} from '../skills/composer';

export const abilityUsedBuilder: AnimationBuilder = (event, children, state) => {
  if (event.type !== 'ABILITY_USED') return null;

  const skillNodes = composeSkillAnimation(event.abilityId, event, children, state);
  if (skillNodes) return skillNodes;

  return [abilityCastNode(event, children)];
};
