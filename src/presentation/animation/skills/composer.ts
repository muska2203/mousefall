/**
 * Единая точка входа для построения анимаций способностей.
 */

import type {GameState} from '@simulation/types';
import type {AnimationNode} from '@presentation/types';
import type {AbilityEvent} from '../core/primitives';
import {getSkillComposer} from './registry';

/** Построить анимацию для способности, если зарегистрирован композер. */
export function composeSkillAnimation(
  abilityId: string,
  event: AbilityEvent,
  childNodes: AnimationNode[],
  state: GameState,
): AnimationNode[] | null {
  const composer = getSkillComposer(abilityId);
  return composer ? composer(event, childNodes, state) : null;
}
