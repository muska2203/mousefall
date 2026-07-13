import { GameState, Position, Entity, StatusEffect } from '@simulation/types';
import { Intent } from '@simulation/systems/intents/types';
import { TargetMode } from '@simulation/core-types';
import { SkillExecutor } from '@simulation/skills/skillExecutor';
import { damageFormulas } from '@simulation/skills/damageFormula';
import { getEntitiesInRadius, getVisiblePositionsWithinRange } from '@simulation/skills/targeting';
import { isCombatEntity, isDamageable } from '@simulation/state';
import { getAbilityTags, getSkillDamageTag } from '@simulation/systems/tags/ability-tags';
import { mergeDamageIntentTags } from '@simulation/systems/tags/tag-helpers';
import { tryGetAbility } from '@content/registry';
import { isContentRulesEnabled } from '@simulation/content-rules/feature-flags.ts';

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
    const affectedEntities = getEntitiesInRadius(state, center, 1);
    const ability = tryGetAbility(this.id);
    const damageTag = getSkillDamageTag(ability);
    const abilityTags = getAbilityTags(this.id);

    for (const entity of affectedEntities) {
      // Предметы и лестницы не получают урона.
      if (entity.type === 'floor_item_container' || entity.type === 'stairs') continue;
      if (!isDamageable(entity)) continue;
      const isCenter = entity.x === center.x && entity.y === center.y;
      const formulaId = isCenter ? 'fireball_center' : 'fireball_aoe';
      const baseDamage = 20; // base damage 20
      const formula = damageFormulas[formulaId];
      if (!formula) continue;
      const skillLevel = caster.type === 'player'
        ? (caster.abilities.find(a => a.templateId === 'fireball')?.level ?? 1)
        : 1;
      if (!isCombatEntity(caster)) continue;
      const damageEntries = formula({
        caster,
        target: entity,
        skillLevel,
        baseDamage,
      });
      for (const entry of damageEntries) {
        const tags = mergeDamageIntentTags(entry.tags, abilityTags);
        intents.push({
          type: 'DAMAGE',
          entityId: entity.id,
          sourceEntityId: caster.id,
          damage: entry.damage,
          tags: damageTag ? mergeDamageIntentTags([damageTag], tags) : tags,
        });
      }

      if (!isContentRulesEnabled(state)) {
        const burning: StatusEffect = {
          type: 'burning',
          duration: 3,
          value: Math.max(1, Math.round(entity.maxHp * 0.1)),
          statModifiers: null,
        };
        intents.push({ type: 'APPLY_STATUS', entityId: entity.id, status: burning });
      }
    }

    return intents;
  },
};
