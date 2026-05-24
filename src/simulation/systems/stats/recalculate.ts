/**
 * Пересчёт базовых характеристик игрока.
 *
 * Вызывается при:
 * - Создании персонажа (characterCreation.ts)
 * - Экипировке/снятии предмета
 * - Левел-апе
 * - Наложении/снятии статус-эффектов (если они меняют baseStats)
 *
 * Обновляет maxHp, maxMp, damage, armor в PlayerEntity.
 * Текущие hp/mp не превышают новые максимумы (clamp).
 */

import type { PlayerEntity } from '@simulation/types.ts';
import {
  getBaseMaxHp,
  getBaseMaxMp,
  getBaseDamage,
  getBaseArmor,
} from './base-resolver.ts';
import {
  getEffectiveDodgeChance,
  getEffectiveAccuracy,
  getEffectiveCritChance,
  getEffectiveCritMultiplier,
} from './effective-stats.ts';

export function recalculatePlayerBaseStats(player: PlayerEntity): void {
  // Обновляем derived-кэш: эти поля НЕЛЬЗЯ менять напрямую вне этого вызова.
  player.maxHp = getBaseMaxHp(player);
  player.maxMp = getBaseMaxMp(player);
  player.damage = Math.round(getBaseDamage(player));
  player.armor = Math.round(getBaseArmor(player));

  player.dodgeChance = getEffectiveDodgeChance(player);
  player.accuracy = getEffectiveAccuracy(player);
  player.critChance = getEffectiveCritChance(player);
  player.critMultiplier = getEffectiveCritMultiplier(player);

  player.hp = Math.min(player.hp, player.maxHp);
  player.mp = Math.min(player.mp, player.maxMp);
}
