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

export function recalculatePlayerBaseStats(player: PlayerEntity): void {
  // Обновляем derived-кэш: эти поля НЕЛЬЗЯ менять напрямую вне этого вызова.
  player.maxHp = getBaseMaxHp(player);
  player.maxMp = getBaseMaxMp(player);
  player.damage = getBaseDamage(player);
  player.armor = getBaseArmor(player);

  player.hp = Math.min(player.hp, player.maxHp);
  player.mp = Math.min(player.mp, player.maxMp);
}
