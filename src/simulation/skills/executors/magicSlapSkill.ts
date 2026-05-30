import { GameState, Position, Entity } from '@simulation/types';
import { Intent } from '@simulation/systems/intents/types';
import { TargetMode } from '@simulation/core-types';
import { SkillExecutor } from '@simulation/skills/skillExecutor';
import { damageFormulas } from '@simulation/skills/damageFormula';
import { getEnemyPositionsWithinRange } from '@simulation/skills/targeting';
import { isCombatEntity } from '@simulation/state';

export const magicSlapSkill: SkillExecutor = {
  id: 'magic_slap',

  getTargetMode(): TargetMode {
    return { type: 'multi', range: 5, count: 3 };
  },

  getValidTargets(state: GameState, caster: Entity): Position[] {
    return getEnemyPositionsWithinRange(state, caster, 5);
  },

  preview(state: GameState, caster: Entity, selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
    const previewTargets = [...selectedTargets];
    if (hoveredTarget && previewTargets.length < 3) {
      previewTargets.push(hoveredTarget);
    }
    return this.resolve(state, caster, previewTargets);
  },

  getAffectedPositions(_state: GameState, _caster: Entity, selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
    const result = [...selectedTargets];
    if (hoveredTarget && result.length < 3) {
      result.push(hoveredTarget);
    }
    return result;
  },

  resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
    const intents: Intent[] = [];
    const effectiveTargets = targets.slice(0, 3);
    const skillLevel = caster.type === 'player'
      ? (caster.abilities.find(a => a.templateId === 'magic_slap')?.level ?? 1)
      : 1;

    for (const targetPos of effectiveTargets) {
      const entity = Array.from(state.entities.values()).find(
        e => e.x === targetPos.x && e.y === targetPos.y && (e.type === 'player' || e.type === 'enemy')
      );
      if (!entity) continue;

      const formula = damageFormulas['magic_slap'];
      if (!formula) continue;
      if (!isCombatEntity(caster)) continue;
      if (!isCombatEntity(entity)) continue;
      const damageEntries = formula({
        caster,
        target: entity,
        skillLevel,
        baseDamage: 12,
      });

      for (const entry of damageEntries) {
        intents.push({ type: 'DAMAGE', entityId: entity.id, sourceEntityId: caster.id, damage: entry.damage, damageType: entry.damageType });
      }
    }

    return intents;
  },
};
