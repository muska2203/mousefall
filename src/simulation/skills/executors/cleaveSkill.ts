import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {isDamageable} from '@simulation/state';
import {getEffectiveWeaponDamage} from '@simulation/systems/stats/effective-stats';
import {tryGetAbility} from '@content/registry';
import {getAbilityTags, getSkillDamageTag} from '@simulation/systems/tags/ability-tags';
import {getWeaponTags, getWeaponWeightForTag} from '@simulation/systems/tags/weapon-tags';
import {mergeDamageIntentTags} from '@simulation/systems/tags/tag-helpers';

/**
 * Восемь соседних смещений вокруг клетки кастующего.
 * Используются и для выбора цели, и для вычисления боковых клеток удара.
 */
const NEIGHBOR_OFFSETS: Array<{ ox: number; oy: number }> = [
  { ox: 1, oy: 0 },
  { ox: -1, oy: 0 },
  { ox: 0, oy: 1 },
  { ox: 0, oy: -1 },
  { ox: 1, oy: 1 },
  { ox: 1, oy: -1 },
  { ox: -1, oy: 1 },
  { ox: -1, oy: -1 },
];

const CLEAVE_DAMAGE_TAG = 'damage.physical.slashing';

export const cleaveSkill: SkillExecutor = {
  id: 'cleave',

  getTargetMode(): TargetMode {
    return { type: 'single', range: 1 };
  },

  getValidTargets(state: GameState, caster: Entity): Position[] {
    const positions: Position[] = [];

    for (const { ox, oy } of NEIGHBOR_OFFSETS) {
      const x = caster.x + ox;
      const y = caster.y + oy;

      // Клетка должна находиться внутри границ карты.
      if (x >= 0 && x < state.map.width && y >= 0 && y < state.map.height) {
        positions.push({ x, y });
      }
    }

    return positions;
  },

  preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
    if (!hoveredTarget) return [];
    return this.resolve(state, caster, [hoveredTarget]);
  },

  getAffectedPositions(
    _state: GameState,
    caster: Entity,
    _selectedTargets: Position[],
    hoveredTarget: Position | null,
  ): Position[] {
    if (!hoveredTarget) return [];

    const dx = hoveredTarget.x - caster.x;
    const dy = hoveredTarget.y - caster.y;

    const positions: Position[] = [{ x: hoveredTarget.x, y: hoveredTarget.y }];

    for (const { ox, oy } of NEIGHBOR_OFFSETS) {
      // Пропускаем клетку кастующего и центральную клетку удара.
      if (ox === 0 && oy === 0) continue;
      if (ox === dx && oy === dy) continue;

      // Боковые клетки — это соседи целевой клетки по стороне,
      // одновременно являющиеся соседями кастующего (Манхэттенское расстояние
      // от смещения к направлению удара не больше 1).
      if (Math.abs(ox - dx) + Math.abs(oy - dy) <= 1) {
        positions.push({ x: caster.x + ox, y: caster.y + oy });
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
    const skillTag = getSkillDamageTag(ability) ?? CLEAVE_DAMAGE_TAG;
    if (!getSkillDamageTag(ability)) {
      console.warn(`Способность "${this.id}" не имеет damageTag в JSON; использован fallback "${skillTag}"`);
    }

    const baseDamage = getEffectiveWeaponDamage(caster);
    const weight = getWeaponWeightForTag(caster, skillTag);
    const damage = Math.round(baseDamage * weight);
    const tags = mergeDamageIntentTags([skillTag], getAbilityTags(this.id), getWeaponTags(caster));

    for (const pos of affectedPositions) {
      for (const entity of state.entities.values()) {
        if (entity.x !== pos.x || entity.y !== pos.y) continue;

        // Предметы на полу и лестницы не получают урон.
        if (entity.type === 'floor_item_container' || entity.type === 'stairs') continue;
        if (!isDamageable(entity)) continue;

        intents.push({
          type: 'DAMAGE',
          entityId: entity.id,
          sourceEntityId: caster.id,
          damage,
          tags,
        });
      }
    }

    return intents;
  },
};
