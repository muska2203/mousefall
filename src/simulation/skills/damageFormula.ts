import { PlayerEntity, EnemyEntity, Attackable, Entity } from '@simulation/types';
import type { DamageType } from '@simulation/core-types';

export type SkillDamageEntry = {
  damage: number;
  damageType: DamageType;
};

export type DamageFormulaContext = {
  caster: PlayerEntity | EnemyEntity;
  target: Entity & Attackable;
  skillLevel: number;
  baseDamage: number;
};

export type DamageFormula = (ctx: DamageFormulaContext) => SkillDamageEntry[];

function single(damage: number, damageType: DamageType): SkillDamageEntry[] {
  return [{ damage, damageType }];
}

export const damageFormulas: Record<string, DamageFormula> = {
  // Fireball — центр взрыва
  fireball_center: (ctx) => {
    const int = ctx.caster.type === 'player' ? ctx.caster.baseStats.int : 0;
    return single(Math.round(ctx.baseDamage * (1 + int * 0.15) * (1 + ctx.skillLevel * 0.1)), 'fire');
  },
  // Fireball — AoE периметр
  fireball_aoe: (ctx) => {
    const int = ctx.caster.type === 'player' ? ctx.caster.baseStats.int : 0;
    return single(Math.round(ctx.baseDamage * 0.5 * (1 + int * 0.15) * (1 + ctx.skillLevel * 0.1)), 'fire');
  },
  // Magic Slap
  magic_slap: (ctx) => {
    const int = ctx.caster.type === 'player' ? ctx.caster.baseStats.int : 0;
    return single(Math.round(ctx.baseDamage * (1 + int * 0.2) * (1 + ctx.skillLevel * 0.05)), 'electric');
  },
  // Рывок — столкновение с актором
  dash_bump: (ctx) => {
    const str = ctx.caster.type === 'player' ? ctx.caster.baseStats.str : 0;
    return single(Math.round(ctx.baseDamage * (1 + str * 0.1) * (1 + ctx.skillLevel * 0.05)), 'blunt');
  },
  // Отталкивание в препятствие или другого актора
  push_bump: (ctx) => {
    const str = ctx.caster.type === 'player' ? ctx.caster.baseStats.str : 0;
    return single(Math.round(ctx.baseDamage * (1 + str * 0.1) * (1 + ctx.skillLevel * 0.05)), 'blunt');
  },
  // Налёт — удар по земле после приземления
  swoop_slam: (ctx) => {
    const str = ctx.caster.type === 'player' ? ctx.caster.baseStats.str : 0;
    return single(Math.round(ctx.baseDamage * (1 + str * 0.12) * (1 + ctx.skillLevel * 0.05)), 'blunt');
  },
};
