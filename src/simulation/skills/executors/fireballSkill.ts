import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {getVisiblePositionsWithinRange} from '@simulation/skills/targeting';
import {getAbilityTags, getSkillDamageTag} from '@simulation/systems/tags/ability-tags';
import {mergeDamageIntentTags} from '@simulation/systems/tags/tag-helpers';
import {tryGetAbility} from '@content/registry';

/** Параметры исполнителя способности вида «огненный шар» (соответствуют полям шаблона kind 'fireball'). */
export interface FireballSkillParams {
  /** Контентный id способности (шаблона). */
  id: string;
  /** Дальность выбора целевой клетки относительно кастера. */
  range: number;
  /** Радиус зоны поражения вокруг целевой клетки (квадрат по Чебышёву). */
  aoeRadius: number;
  /** Фиксированный урон по центральной клетке зоны. */
  centerDamage: number;
  /** Фиксированный урон по клеткам периметра зоны. */
  aoeDamage: number;
}

/**
 * Фабрика исполнителя способности вида «огненный шар»:
 * урон по квадрату (2·aoeRadius+1)² вокруг выбранной клетки в пределах range,
 * центральная клетка получает centerDamage, периметр — aoeDamage.
 *
 * Урон фиксированный (без скейлинга от характеристик и уровня) —
 * модификаторы урона вешаются через стандартные модификаторы и контентные правила.
 *
 * Параметры механики приходят из шаблона способности (kind 'fireball'),
 * сборку и кэширование выполняет getSkillExecutor.
 */
export function createFireballSkill(params: FireballSkillParams): SkillExecutor {
  /**
   * Возвращает клетки зоны поражения вокруг целевой клетки.
   */
  function getZonePositions(center: Position): Position[] {
    const positions: Position[] = [];
    for (let dy = -params.aoeRadius; dy <= params.aoeRadius; dy++) {
      for (let dx = -params.aoeRadius; dx <= params.aoeRadius; dx++) {
        positions.push({ x: center.x + dx, y: center.y + dy });
      }
    }
    return positions;
  }

  /**
   * Разрешает способность в набор интентов.
   */
  function resolveFireballIntents(state: GameState, caster: Entity, targets: Position[], skillId: string): Intent[] {
    const center = targets[0];
    if (!center) return [];

    const intents: Intent[] = [];
    const ability = tryGetAbility(skillId);
    const damageTag = getSkillDamageTag(ability);
    const abilityTags = getAbilityTags(skillId);

    for (const position of getZonePositions(center)) {
      const isCenter = position.x === center.x && position.y === center.y;
      const damage = isCenter ? params.centerDamage : params.aoeDamage;
      const tags = damageTag
        ? mergeDamageIntentTags([damageTag], abilityTags)
        : abilityTags;
      intents.push({
        type: 'DAMAGE_TILE',
        position,
        sourceEntityId: caster.id,
        damage,
        tags,
      });
    }

    return intents;
  }

  return {
    id: params.id,

    getTargetMode(): TargetMode {
      return { type: 'single', range: params.range };
    },

    getValidTargets(state: GameState, caster: Entity): Position[] {
      return getVisiblePositionsWithinRange(state, caster, params.range);
    },

    preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
      if (!hoveredTarget) return [];
      return resolveFireballIntents(state, caster, [hoveredTarget], this.id);
    },

    getAffectedPositions(_state: GameState, _caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
      if (!hoveredTarget) return [];
      return getZonePositions(hoveredTarget);
    },

    resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
      return resolveFireballIntents(state, caster, targets, this.id);
    },
  };
}
