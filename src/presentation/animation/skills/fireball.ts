/**
 * Анимационный композер для способности Fireball.
 */

import {randomInt} from '@utils/random';
import type {AbilityEvent} from '../core/primitives';
import {abilityCastNode, explosionNode, projectileNode} from '../core/primitives';
import type {SkillComposer} from './registry';
import {registerSkillComposer} from './registry';

export const fireballComposer: SkillComposer = (event: AbilityEvent, children, state) => {
  const target = event.targets[0];
  if (!target) {
    return [abilityCastNode(event, children)];
  }

  const mapWidth = state.map?.width ?? 1;
  const minX = Math.max(0, target.x - 7);
  const maxX = Math.min(mapWidth - 1, target.x + 7);
  const from = { x: randomInt(minX, Math.max(minX, maxX)), y: -1 };

  return [
    abilityCastNode(event, [
      projectileNode(from, target, [
        explosionNode(target, 1, children),
      ], true),
    ]),
  ];
};

registerSkillComposer('fireball', fireballComposer);
