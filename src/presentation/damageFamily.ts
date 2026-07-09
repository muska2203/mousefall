/**
 * Семейство урона для визуализации (цвет floating text, частиц и т.д.).
 *
 * Presentation-уровень: UI не должна разбирать иерархические теги урона напрямую,
 * поэтому семейство вычисляется здесь через hasTag.
 */

import type { GameplayTag } from '@simulation/core-types';
import { hasTag } from '@simulation/systems/tags/tag-helpers';

export type DamageFamily = 'slashing' | 'piercing' | 'blunt' | 'fire' | 'electric' | 'poison' | 'frost' | 'physical';

/**
 * Определяет семейство урона по иерархическим тегам.
 * Использует hasTag, чтобы учитывать потомков (например, damage.magical.fire
 * удовлетворяет проверке damage.magical.fire).
 */
export function getDamageFamily(tags: GameplayTag[]): DamageFamily {
  if (hasTag(tags, 'damage.magical.fire')) return 'fire';
  if (hasTag(tags, 'damage.magical.electric')) return 'electric';
  if (hasTag(tags, 'damage.magical.poison')) return 'poison';
  if (hasTag(tags, 'damage.magical.frost')) return 'frost';
  if (hasTag(tags, 'damage.physical.slashing')) return 'slashing';
  if (hasTag(tags, 'damage.physical.piercing')) return 'piercing';
  if (hasTag(tags, 'damage.physical.blunt')) return 'blunt';
  return 'physical';
}
