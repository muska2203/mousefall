/**
 * Ролл урона оружия в момент удара.
 *
 * Урон оружия — рейнж {min, max}; конкретное значение выбирается здесь,
 * в точке нанесения урона (атака, контратака, weapon-based скиллы).
 * Ролл смещён вверх эффективной ловкостью атакующего по формуле
 * `min + round((max − min) × u^(1/(1 + dex·DEX_DAMAGE_BIAS_K)))`.
 *
 * Ролл детерминирован: используется state.runtimeRng (сериализуется с сейвом).
 */

import type {Entity, GameState} from '@simulation/types.ts';
import {DEX_DAMAGE_BIAS_K} from '@utils/constants.ts';
import {rngFloat} from '@utils/rng.ts';
import {getEffectiveBaseStats} from './effective-base-stats.ts';
import {getEffectiveWeaponDamageRange, isStatActor} from './effective-stats.ts';

/**
 * Роллит урон оружия актора в момент удара.
 * Возвращает целое значение в [min, max] эффективного рейнжа,
 * смещённое вверх ловкостью (для не-StatActor dex = 0).
 */
export function rollWeaponDamage(state: GameState, actor: Entity): number {
  const range = getEffectiveWeaponDamageRange(actor);
  const dex = isStatActor(actor) ? getEffectiveBaseStats(actor).dex : 0;

  const u = rngFloat(state.runtimeRng);
  const exponent = 1 / (1 + dex * DEX_DAMAGE_BIAS_K);
  return range.min + Math.round((range.max - range.min) * Math.pow(u, exponent));
}
