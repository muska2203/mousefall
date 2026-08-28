/**
 * Аффиксы (модификаторы) экземпляра экипировки.
 *
 * Экземпляр несёт единый список аффиксов двух видов (origin):
 * - фирменные ('fixed') — задаются шаблоном через fixedModifiers, детерминированы
 *   (значение из scaling 'fixed' или null для scaling 'none');
 * - случайные ('rolled') — роллятся один раз при создании экземпляра (inventory-factory)
 *   через seeded `state.rng`; результат детерминирован и сериализуется
 *   в составе InventoryItem. Не переролливается ни при экипировке, ни при загрузке сейва.
 *
 * Алгоритм ролла случайных аффиксов (концепт equipment-modifiers §4):
 * 1. пул = модификаторы с poolEligible, чьи applicableSubtypes содержат subtype предмета;
 *    исключаются модификаторы, уже присутствующие в fixedModifiers шаблона,
 *    и модификаторы, чей ruleId конфликтует с rule-модификатором из fixedModifiers;
 * 2. из положительных — взвешенный выбор 1 (если пул непуст);
 * 3. отрицательный — с шансом NEGATIVE_AFFIX_CHANCE, взвешенный выбор 1;
 * 4. value = rngInt из ranges[level-1] (с clamp к последнему рейнжу);
 *    для scaling 'none'/'fixed' у ролленных аффиксов быть не должно — value = null.
 */

import type {ItemTemplate, ModifierTemplate} from '@content/schemas';
import {getRegistry, tryGetModifier} from '@content/registry';
import type {ItemAffix, RNGState, StatModifier} from '@simulation/types';
import {NEGATIVE_AFFIX_CHANCE} from '@utils/constants';
import {rngFloat, rngInt} from '@utils/rng';

/** Возвращает реестр модификаторов (пустой, если реестр не инициализирован — тесты, ранняя инициализация). */
function getModifiersSafe(): ReadonlyMap<string, ModifierTemplate> {
  try {
    return getRegistry().modifiers ?? new Map<string, ModifierTemplate>();
  } catch {
    return new Map<string, ModifierTemplate>();
  }
}

/**
 * Взвешенный выбор одного модификатора из непустого пула.
 * Мутирует rng.state.
 */
function pickWeighted(rng: RNGState, pool: readonly ModifierTemplate[]): ModifierTemplate {
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rngFloat(rng) * totalWeight;

  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry;
    }
  }

  // Fallback на последний элемент (защита от floating-point погрешности).
  return pool[pool.length - 1]!;
}

/**
 * Роллит значение аффикса из рейнжа уровня предмета.
 * Уровень выше длины ranges — clamp к последнему рейнжу.
 * Для scaling 'none'/'fixed' возвращает null.
 */
function rollAffixValue(rng: RNGState, modifier: ModifierTemplate, level: number): number | null {
  if (modifier.scaling.kind !== 'perLevel') {
    return null;
  }
  const ranges = modifier.scaling.ranges;
  const range = ranges[Math.min(level, ranges.length) - 1]!;
  return rngInt(rng, range.min, range.max);
}

/** Значение фирменного аффикса: из scaling 'fixed', иначе null. */
function fixedAffixValue(modifier: ModifierTemplate): number | null {
  return modifier.scaling.kind === 'fixed' ? modifier.scaling.value : null;
}

/**
 * Собирает фирменные аффиксы шаблона предмета (fixedModifiers → ItemAffix с origin 'fixed').
 * Порядок соответствует порядку fixedModifiers в шаблоне.
 */
export function buildFixedAffixes(template: ItemTemplate): ItemAffix[] {
  const modifiers = getModifiersSafe();
  const affixes: ItemAffix[] = [];

  for (const modifierId of template.fixedModifiers ?? []) {
    const modifier = modifiers.get(modifierId);
    if (!modifier) continue;
    affixes.push({ modifierId, value: fixedAffixValue(modifier), origin: 'fixed' });
  }

  return affixes;
}

/**
 * Роллит случайные аффиксы для нового экземпляра предмета (origin 'rolled').
 * Для предметов без subtype (расходники, ключи, золото) возвращает пустой массив.
 * Мутирует rng.state.
 */
export function rollItemAffixes(rng: RNGState, template: ItemTemplate): ItemAffix[] {
  const subtype = template.subtype;
  if (!subtype) {
    return [];
  }

  const modifiers = getModifiersSafe();

  // Исключения: модификаторы, уже закреплённые в шаблоне, и конфликты по ruleId —
  // иначе аффикс был бы «пустым» (правило дедуплицируется по ruleId + ownerContext).
  const fixedIds = new Set(template.fixedModifiers ?? []);
  const fixedRuleIds = new Set<string>();
  for (const modifierId of fixedIds) {
    const modifier = modifiers.get(modifierId);
    if (modifier?.effect.kind === 'rule') {
      fixedRuleIds.add(modifier.effect.ruleId);
    }
  }

  const pool = Array.from(modifiers.values())
    .filter((modifier) => modifier.poolEligible)
    .filter((modifier) => modifier.applicableSubtypes.includes(subtype))
    .filter((modifier) => !fixedIds.has(modifier.id))
    .filter((modifier) => modifier.effect.kind !== 'rule' || !fixedRuleIds.has(modifier.effect.ruleId));
  if (pool.length === 0) {
    return [];
  }

  const affixes: ItemAffix[] = [];
  const level = template.level ?? 1;

  const positives = pool.filter((modifier) => modifier.polarity === 'positive');
  if (positives.length > 0) {
    const modifier = pickWeighted(rng, positives);
    affixes.push({ modifierId: modifier.id, value: rollAffixValue(rng, modifier, level), origin: 'rolled' });
  }

  const negatives = pool.filter((modifier) => modifier.polarity === 'negative');
  if (negatives.length > 0 && rngFloat(rng) < NEGATIVE_AFFIX_CHANCE) {
    const modifier = pickWeighted(rng, negatives);
    affixes.push({ modifierId: modifier.id, value: rollAffixValue(rng, modifier, level), origin: 'rolled' });
  }

  return affixes;
}

/**
 * Полный набор аффиксов нового экземпляра: фирменные (в порядке шаблона) + случайные.
 * Мутирует rng.state (только роллом случайных аффиксов).
 */
export function createItemAffixes(rng: RNGState, template: ItemTemplate): ItemAffix[] {
  return [...buildFixedAffixes(template), ...rollItemAffixes(rng, template)];
}

/**
 * Stat-модификаторы из списка ID модификаторов (без привязки к предмету).
 * Используется для врагов: stat-свойства читаются из modifiers шаблона сущности.
 */
export function collectStatModifiersFromIds(ids: readonly string[]): Array<Omit<StatModifier, 'source'>> {
  const result: Array<Omit<StatModifier, 'source'>> = [];

  for (const modifierId of ids) {
    const modifier = tryGetModifier(modifierId);
    if (!modifier || modifier.effect.kind !== 'stat') continue;
    result.push({
      stat: modifier.effect.stat,
      value: fixedAffixValue(modifier) ?? 0,
      op: modifier.effect.op,
    });
  }

  return result;
}

/**
 * ID правил из списка ID модификаторов (без привязки к предмету).
 * Используется при пересборке activeRules врагов.
 */
export function collectRuleIdsFromIds(ids: readonly string[]): string[] {
  const ruleIds: string[] = [];

  for (const modifierId of ids) {
    const modifier = tryGetModifier(modifierId);
    if (modifier?.effect.kind === 'rule') {
      ruleIds.push(modifier.effect.ruleId);
    }
  }

  return ruleIds;
}

/**
 * Stat-модификаторы из фирменных модификаторов шаблона (без экземпляра).
 * Используется там, где предмет существует только как шаблон (превью характеристик).
 */
export function collectFixedStatModifiers(template: ItemTemplate): Array<Omit<StatModifier, 'source'>> {
  return collectStatModifiersFromIds(template.fixedModifiers ?? []);
}

/**
 * ID правил из фирменных модификаторов шаблона (без экземпляра).
 */
export function collectFixedRuleIds(template: ItemTemplate): string[] {
  return collectRuleIdsFromIds(template.fixedModifiers ?? []);
}
