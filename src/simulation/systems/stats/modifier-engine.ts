/**
 * Движок модификаторов (Modifier Engine).
 *
 * Ответственность:
 * - Применение временных и постоянных модификаторов к базовым значениям.
 * - Управление charges-based модификаторами.
 * - Соблюдение порядка: сначала multiply, потом add.
 *
 * Правила:
 * - Дубликаты по source нельзя накладывать дважды — при повторном наложении
 *   увеличивается charges (если есть) или обновляется value.
 */

import type {StatActor, StatModifier} from '@simulation/types.ts';

export type ModifierBreakdownEntry = {
  source: string;
  value: number;
  op: 'add' | 'multiply';
};

export type ModifierResult = {
  total: number;
  breakdown: ModifierBreakdownEntry[];
};

/**
 * Применяет модификаторы к базовому значению.
 * Формула: (base × (1 + sum(multiply))) + sum(add).
 */
export function applyModifiers(
  actor: StatActor,
  stat: string,
  baseValue: number,
): ModifierResult {
  const relevant = actor.statModifiers.filter((m) => m.stat === stat);

  const addMods = relevant.filter((m) => m.op === 'add');
  const multMods = relevant.filter((m) => m.op === 'multiply');

  const addSum = addMods.reduce((sum, m) => sum + m.value, 0);
  const multSum = multMods.reduce((sum, m) => sum + m.value, 0);

  const total = baseValue * (1 + multSum) + addSum;

  const breakdown: ModifierBreakdownEntry[] = [
    ...multMods.map((m) => ({ source: m.source, value: m.value, op: m.op })),
    ...addMods.map((m) => ({ source: m.source, value: m.value, op: m.op })),
  ];

  return { total: Math.max(0, total), breakdown };
}

/**
 * Добавляет модификатор к сущности.
 * Если модификатор с таким source уже существует для этого stat —
 * увеличивает charges (если переданы) или обновляет value.
 */
export function addModifier(actor: StatActor, modifier: StatModifier): void {
  const existing = actor.statModifiers.find(
    (m) => m.source === modifier.source && m.stat === modifier.stat,
  );

  if (existing) {
    if (modifier.charges !== undefined) {
      existing.charges = (existing.charges ?? 0) + modifier.charges;
    } else {
      existing.value = modifier.value;
      existing.op = modifier.op;
    }
  } else {
    actor.statModifiers.push({ ...modifier });
  }

}

/**
 * Удаляет все модификаторы с указанным source.
 */
export function removeModifiersBySource(actor: StatActor, source: string): void {
  actor.statModifiers = actor.statModifiers.filter((m) => m.source !== source);
}

/**
 * Тратит один charge модификатора указанного stat.
 * Если source не указан — тратит первый подходящий.
 * Возвращает true, если charge был потрачен.
 */
export function consumeCharge(
  actor: StatActor,
  stat: string,
  source?: string,
): boolean {
  const index = actor.statModifiers.findIndex(
    (m) => m.stat === stat && m.charges !== undefined && (source ? m.source === source : true),
  );

  if (index === -1) return false;

  const mod = actor.statModifiers[index]!;
  if ((mod.charges ?? 0) <= 1) {
    actor.statModifiers.splice(index, 1);
  } else {
    mod.charges!--;
  }

  return true;
}
