/**
 * Пересчёт базовых характеристик игрока.
 *
 * Вызывается при:
 * - Создании персонажа (characterCreation.ts)
 * - Экипировке/снятии предмета
 * - Левел-апе
 * - Наложении/снятии статус-эффектов (если они меняют baseStats)
 *
 * Обновляет maxHp, damage, armor в PlayerEntity.
 * Текущие hp/mp не превышают новые максимумы (clamp).
 */

import type { Actor, StatActor } from '@simulation/types.ts';
import {
  getBaseMaxHp,
  getBaseDamage,
  getBaseArmor,
} from './base-resolver.ts';
import {
  getEffectiveDodgeChance,
  getEffectiveAccuracy,
  getEffectiveCritChance,
  getEffectiveCritMultiplier,
} from './effective-stats.ts';

export function recalculateActorStats(actor: StatActor & Actor): void {
  // Обновляем derived-кэш: эти поля НЕЛЬЗЯ менять напрямую вне этого вызова.
  actor.maxHp = getBaseMaxHp(actor);
  actor.damage = Math.round(getBaseDamage(actor));
  actor.armor = Math.round(getBaseArmor(actor));

  actor.dodgeChance = getEffectiveDodgeChance(actor);
  actor.accuracy = getEffectiveAccuracy(actor);
  actor.critChance = getEffectiveCritChance(actor);
  actor.critMultiplier = getEffectiveCritMultiplier(actor);

  actor.hp = Math.min(actor.hp, actor.maxHp);
}

/** @deprecated Используйте recalculateActorStats */
export function recalculatePlayerBaseStats(player: StatActor & Actor): void {
  recalculateActorStats(player);
}
