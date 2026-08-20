import {Attackable, Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {getDamageablePositionsWithinRange, getVisiblePositionsWithinRange} from '@simulation/skills/targeting';
import {isDamageable} from '@simulation/state';
import {getAbilityTags, getSkillDamageTag} from '@simulation/systems/tags/ability-tags';
import {mergeDamageIntentTags} from '@simulation/systems/tags/tag-helpers';
import {tryGetAbility} from '@content/registry';

/** Параметры исполнителя способности вида «магическая пощёчина» (соответствуют полям шаблона kind 'magicSlap'). */
export interface MagicSlapSkillParams {
  /** Контентный id способности (шаблона). */
  id: string;
  /** Дальность выбора целей относительно кастера. */
  range: number;
  /** Максимальное число целей за одно применение. */
  targetCount: number;
  /** Фиксированный урон по каждой цели. */
  baseDamage: number;
}

/**
 * Фабрика исполнителя способности вида «магическая пощёчина»:
 * урон по нескольким (до targetCount) выбранным целям в пределах range,
 * одна и та же цель может быть выбрана несколько раз.
 *
 * Урон фиксированный (без скейлинга от характеристик и уровня) —
 * модификаторы урона вешаются через стандартные модификаторы и контентные правила.
 *
 * Параметры механики приходят из шаблона способности (kind 'magicSlap'),
 * сборку и кэширование выполняет getSkillExecutor.
 */
export function createMagicSlapSkill(params: MagicSlapSkillParams): SkillExecutor {
  /**
   * Дополняет уже выбранные цели наведённой (для превью и подсветки зоны).
   */
  function withHovered(selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
    const result = [...selectedTargets];
    if (hoveredTarget && result.length < params.targetCount) {
      result.push(hoveredTarget);
    }
    return result;
  }

  /**
   * Разрешает способность в набор интентов.
   */
  function resolveMagicSlapIntents(state: GameState, caster: Entity, targets: Position[], skillId: string): Intent[] {
    const intents: Intent[] = [];
    const effectiveTargets = targets.slice(0, params.targetCount);
    const ability = tryGetAbility(skillId);
    const damageTag = getSkillDamageTag(ability);
    const abilityTags = getAbilityTags(skillId);

    for (const targetPos of effectiveTargets) {
      const entity = Array.from(state.entities.values()).find(
        (e): e is Entity & Attackable => e.x === targetPos.x && e.y === targetPos.y && isDamageable(e)
      );
      if (!entity) continue;

      const tags = damageTag
        ? mergeDamageIntentTags([damageTag], abilityTags)
        : abilityTags;
      intents.push({
        type: 'DAMAGE',
        entityId: entity.id,
        sourceEntityId: caster.id,
        damage: params.baseDamage,
        tags,
      });
    }

    return intents;
  }

  return {
    id: params.id,

    getTargetMode(): TargetMode {
      return { type: 'multi', range: params.range, count: params.targetCount };
    },

    getValidTargets(state: GameState, caster: Entity): Position[] {
      return getDamageablePositionsWithinRange(state, caster, params.range);
    },

    getCastableCells(state: GameState, caster: Entity): Position[] {
      // Паттерн прицеливания: все видимые клетки в пределах range,
      // независимо от наличия целей; клетка кастера исключается.
      return getVisiblePositionsWithinRange(state, caster, params.range)
        .filter(pos => pos.x !== caster.x || pos.y !== caster.y);
    },

    preview(state: GameState, caster: Entity, selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
      return resolveMagicSlapIntents(state, caster, withHovered(selectedTargets, hoveredTarget), this.id);
    },

    getAffectedPositions(_state: GameState, _caster: Entity, selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
      return withHovered(selectedTargets, hoveredTarget);
    },

    resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
      return resolveMagicSlapIntents(state, caster, targets, this.id);
    },
  };
}
