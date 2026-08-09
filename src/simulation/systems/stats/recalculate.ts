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

import type {Actor, StatActor} from '@simulation/types.ts';
import {getBaseArmor, getBaseDamageRange, getBaseMaxHp,} from './base-resolver.ts';
import {applyDamageModifiers, getEffectiveCritMultiplier, getEffectiveMaxHp,} from './effective-stats.ts';
import {applyModifiers} from './modifier-engine.ts';

export function recalculateActorStats(actor: StatActor & Actor): void {
  // Обновляем derived-кэш: эти поля НЕЛЬЗЯ менять напрямую вне этого вызова.
  // Кэш хранит итоговые значения: база (baseStats, экипировка) + stat-модификаторы
  // (аффиксы предметов, реликвии, статусы) — как в getEffective*-функциях.
  actor.maxHp = Math.round(getEffectiveMaxHp(actor));
  actor.damage = applyDamageModifiers(actor, getBaseDamageRange(actor));
  actor.armor = Math.round(applyModifiers(actor, 'armor', getBaseArmor(actor)).total);

  actor.critMultiplier = getEffectiveCritMultiplier(actor);

  actor.hp = Math.min(actor.hp, actor.maxHp);
}

/** @deprecated Используйте recalculateActorStats */
export function recalculatePlayerBaseStats(player: StatActor & Actor): void {
  recalculateActorStats(player);
}
