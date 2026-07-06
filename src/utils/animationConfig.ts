/**
 * Централизованная конфигурация анимаций.
 *
 * Правила:
 * - Единственная точка правки длительностей, флагов blocking и easing.
 * - Presentation и UI читают отсюда, не хардкодят числа.
 */

import { Easing } from './tween';
import type { EasingFn } from './tween';

export type AnimationConfigEntry = {
  duration: number;
  blocking: boolean;
  easing: EasingFn;
};

export const ANIMATION_CONFIG = {
  MOVE: { duration: 200, blocking: true, easing: Easing.linear },
  JUMP: { duration: 450, blocking: true, easing: Easing.easeOutQuad },
  TILE_SHAKE: { duration: 250, blocking: false, easing: Easing.linear },
  ATTACK: { duration: 250, blocking: true, easing: Easing.easeOutQuad },
  DAMAGE: { duration: 800, blocking: true, easing: Easing.linear },
  HP_CHANGE: { duration: 100, blocking: false, easing: Easing.easeOutQuad },
  DEATH: { duration: 300, blocking: true, easing: Easing.easeInQuad },
  FOG_UPDATE: { duration: 150, blocking: false, easing: Easing.linear },
  PARTICLE_BURST: { duration: 300, blocking: false, easing: Easing.easeOutQuad },
  UI_FLOATING_TEXT: { duration: 600, blocking: false, easing: Easing.linear },
  ABILITY_CAST: { duration: 250, blocking: true, easing: Easing.easeOutQuad },
  PROJECTILE: { duration: 300, blocking: true, easing: Easing.easeOutQuad },
  SLASH_ARC: { duration: 250, blocking: true, easing: Easing.easeOutQuad },
  EXPLOSION: { duration: 250, blocking: true, easing: Easing.easeOutQuad },
  STATUS_BURST: { duration: 400, blocking: false, easing: Easing.easeOutQuad },
  ITEM_DROP: { duration: 200, blocking: false, easing: Easing.easeOutQuad },
  BOUNCE: { duration: 150, blocking: true, easing: Easing.easeOutBack },
} as const satisfies Record<string, AnimationConfigEntry>;

export type AnimationConfigKey = keyof typeof ANIMATION_CONFIG;
