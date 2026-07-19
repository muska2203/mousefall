/**
 * Вычисление эффективных базовых характеристик актора.
 *
 * Изолирован в отдельный модуль, чтобы разорвать круговую зависимость
 * между base-resolver.ts и weapon-formulas.ts.
 */

import type {StatActor} from '@simulation/types.ts';
import {applyModifiers} from './modifier-engine.ts';

export type EffectiveBaseStats = {
  str: number;
  dex: number;
  int: number;
  vit: number;
};

export function getEffectiveBaseStats(actor: StatActor): EffectiveBaseStats {
  return {
    str: applyModifiers(actor, 'str', actor.baseStats.str).total,
    dex: applyModifiers(actor, 'dex', actor.baseStats.dex).total,
    int: applyModifiers(actor, 'int', actor.baseStats.int).total,
    vit: applyModifiers(actor, 'vit', actor.baseStats.vit).total,
  };
}
