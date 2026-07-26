/**
 * Анимационный композер для способности Fireball.
 */

import {randomInt} from '@utils/random';
import type {AbilityEvent} from '../core/primitives';
import {abilityCastNode, meteorFallNode} from '../core/primitives';
import type {SkillComposer} from './registry';
import {registerSkillComposer} from './registry';

/** Цвет огненного метеорита. */
const FIREBALL_METEOR_COLOR = 0xff5500;

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
      meteorFallNode(from, target, FIREBALL_METEOR_COLOR, children),
    ]),
  ];
};

registerSkillComposer('fireball', fireballComposer);
