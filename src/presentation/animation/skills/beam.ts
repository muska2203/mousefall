/**
 * Анимационный композер для способности "Молниеносный разряд" (lightning_bolt).
 *
 * Демонстрирует кастомный шаг BEAM: каст способности → луч от кастера к цели
 * → дочерние эффекты (урон, статусы и т.д.).
 */

import type {AbilityEvent} from '../core/primitives';
import {abilityCastNode, beamNode} from '../core/primitives';
import type {SkillComposer} from './registry';
import {registerSkillComposer} from './registry';

/** Цвет молнии. */
const LIGHTNING_COLOR = 0x88ddff;

export const lightningBoltComposer: SkillComposer = (event: AbilityEvent, children) => {
  const target = event.targets[0];
  if (!target) {
    return [abilityCastNode(event, children)];
  }

  return [
    abilityCastNode(event, [
      beamNode(event.from, target, LIGHTNING_COLOR, children),
    ]),
  ];
};

registerSkillComposer('lightning_bolt', lightningBoltComposer);
