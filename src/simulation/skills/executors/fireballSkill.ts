import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {damageFormulas} from '@simulation/skills/damageFormula';
import {getVisiblePositionsWithinRange} from '@simulation/skills/targeting';
import {isCombatEntity} from '@simulation/state';
import {getAbilityTags, getSkillDamageTag} from '@simulation/systems/tags/ability-tags';
import {mergeDamageIntentTags} from '@simulation/systems/tags/tag-helpers';
import {tryGetAbility} from '@content/registry';

export const fireballSkill: SkillExecutor = {
  id: 'fireball',

  getTargetMode(): TargetMode {
    return { type: 'single', range: 5 };
  },

  getValidTargets(state: GameState, caster: Entity): Position[] {
    return getVisiblePositionsWithinRange(state, caster, 5);
  },

  preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
    if (!hoveredTarget) return [];
    return this.resolve(state, caster, [hoveredTarget]);
  },

  getAffectedPositions(_state: GameState, _caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
    if (!hoveredTarget) return [];
    const positions: Position[] = [];
    const radius = 1;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        positions.push({ x: hoveredTarget.x + dx, y: hoveredTarget.y + dy });
      }
    }
    return positions;
  },

  resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
    const center = targets[0];
    if (!center) return [];

    const intents: Intent[] = [];
    const affectedPositions = this.getAffectedPositions(state, caster, [], center);
    const ability = tryGetAbility(this.id);
    const damageTag = getSkillDamageTag(ability);
    const abilityTags = getAbilityTags(this.id);

    if (!isCombatEntity(caster)) return [];
    const skillLevel = caster.type === 'player'
      ? (caster.abilities.find(a => a.templateId === 'fireball')?.level ?? 1)
      : 1;
    const baseDamage = 20;

    for (const position of affectedPositions) {
      const isCenter = position.x === center.x && position.y === center.y;
      const formulaId = isCenter ? 'fireball_center' : 'fireball_aoe';
      const formula = damageFormulas[formulaId];
      if (!formula) continue;

      const damageEntries = formula({
        caster,
        skillLevel,
        baseDamage,
      });

      for (const entry of damageEntries) {
        const tags = mergeDamageIntentTags(entry.tags, abilityTags);
        intents.push({
          type: 'DAMAGE_TILE',
          position,
          sourceEntityId: caster.id,
          damage: entry.damage,
          tags: damageTag ? mergeDamageIntentTags([damageTag], tags) : tags,
        });
      }
    }

    return intents;
  },
};
