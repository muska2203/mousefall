import { PlayerEntity, EnemyEntity } from '@simulation/types';

export type DamageFormulaContext = {
  caster: PlayerEntity | EnemyEntity;
  target: PlayerEntity | EnemyEntity;
  skillLevel: number;
  baseDamage: number;
};

export type DamageFormula = (ctx: DamageFormulaContext) => number;

export const damageFormulas: Record<string, DamageFormula> = {
  // Fireball — центр взрыва
  fireball_center: (ctx) => {
    const int = ctx.caster.type === 'player' ? ctx.caster.baseStats.int : 0;
    return Math.round(ctx.baseDamage * (1 + int * 0.15) * (1 + ctx.skillLevel * 0.1));
  },
  // Fireball — AoE периметр
  fireball_aoe: (ctx) => {
    const int = ctx.caster.type === 'player' ? ctx.caster.baseStats.int : 0;
    return Math.round(ctx.baseDamage * 0.5 * (1 + int * 0.15) * (1 + ctx.skillLevel * 0.1));
  },
  // Magic Slap
  magic_slap: (ctx) => {
    const int = ctx.caster.type === 'player' ? ctx.caster.baseStats.int : 0;
    return Math.round(ctx.baseDamage * (1 + int * 0.2) * (1 + ctx.skillLevel * 0.05));
  },
};
