import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {getDamageablePositionsWithinRange, getVisiblePositionsWithinRange} from '@simulation/skills/targeting';
import {findFirstAttackableEntityAt} from '@simulation/state';
import {getAbilityTags, getSkillDamageTag} from '@simulation/systems/tags/ability-tags';
import {mergeDamageIntentTags} from '@simulation/systems/tags/tag-helpers';
import {tryGetAbility} from '@content/registry';

/** Параметры исполнителя способности вида «бросок» (соответствуют полям шаблона kind 'throw'). */
export interface ThrowSkillParams {
  /** Контентный id способности (шаблона). */
  id: string;
  /** Дальность выбора цели относительно кастера (Чебышёв, только 8 лучей-направлений). */
  range: number;
  /** Фиксированный урон по цели. */
  baseDamage: number;
  /** Дистанция отталкивания цели в клетках (0 — без толчка). */
  pushDistance: number;
}

/**
 * Фабрика исполнителя способности вида «бросок»:
 * урон по одной цели в прямой видимости в пределах range
 * с отталкиванием цели от кастера на pushDistance клеток.
 *
 * Таргетинг — по 8 лучам-направлениям от кастера (как у рывка dash): цель
 * должна лежать строго на ортогонали или диагонали. Поэтому направление
 * толчка (знаковая редукция вектора к цели) всегда совпадает с направлением
 * броска — «диагонального» толчка от почти горизонтального попадания не бывает.
 *
 * Урон фиксированный (без скейлинга от характеристик и уровня) —
 * модификаторы урона вешаются через стандартные модификаторы и контентные правила.
 * Урон и daze при столкновении от толчка обрабатываются глобальными
 * правилами collision_damage/collision_daze — отдельных интентов не требуется.
 *
 * Параметры механики приходят из шаблона способности (kind 'throw'),
 * сборку и кэширование выполняет getSkillExecutor.
 */
export function createThrowSkill(params: ThrowSkillParams): SkillExecutor {
  /**
   * Проверяет, что клетка лежит на одном из 8 лучей от кастера.
   */
  function isOnRay(caster: Entity, pos: Position): boolean {
    const dx = pos.x - caster.x;
    const dy = pos.y - caster.y;
    if (dx === 0 && dy === 0) return false;
    return dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
  }

  /**
   * Разрешает способность в набор интентов.
   */
  function resolveThrowIntents(state: GameState, caster: Entity, targets: Position[], skillId: string): Intent[] {
    const target = targets[0];
    if (!target) return [];

    const entity = findFirstAttackableEntityAt(state, target.x, target.y);
    if (!entity) return [];

    const ability = tryGetAbility(skillId);
    const damageTag = getSkillDamageTag(ability);
    const abilityTags = getAbilityTags(skillId);

    const tags = damageTag
      ? mergeDamageIntentTags([damageTag], abilityTags)
      : abilityTags;
    const intents: Intent[] = [{
      type: 'DAMAGE',
      entityId: entity.id,
      sourceEntityId: caster.id,
      damage: params.baseDamage,
      tags,
    }];

    // Отталкивание: цепочка одноклеточных PUSH от кастера через цель.
    // Цель всегда на луче (см. getValidTargets), поэтому знаковая редукция
    // вектора — это в точности направление луча.
    const pushDx = Math.sign(entity.x - caster.x);
    const pushDy = Math.sign(entity.y - caster.y);
    if (pushDx !== 0 || pushDy !== 0) {
      for (let i = 0; i < params.pushDistance; i++) {
        intents.push({
          type: 'PUSH',
          entityId: entity.id,
          dx: pushDx,
          dy: pushDy,
          sourceEntityId: caster.id,
        });
      }
    }

    return intents;
  }

  return {
    id: params.id,

    getTargetMode(): TargetMode {
      return { type: 'single', range: params.range };
    },

    getValidTargets(state: GameState, caster: Entity): Position[] {
      // Только цели на 8 лучах от кастера (ортогонали и диагонали).
      return getDamageablePositionsWithinRange(state, caster, params.range)
        .filter(pos => isOnRay(caster, pos));
    },

    getCastableCells(state: GameState, caster: Entity): Position[] {
      // Паттерн прицеливания: все видимые клетки на 8 лучах в пределах range,
      // независимо от наличия целей (клетка кастера исключена проверкой isOnRay).
      return getVisiblePositionsWithinRange(state, caster, params.range)
        .filter(pos => isOnRay(caster, pos));
    },

    preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
      if (!hoveredTarget) return [];
      return resolveThrowIntents(state, caster, [hoveredTarget], this.id);
    },

    getAffectedPositions(_state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
      if (!hoveredTarget) return [];
      // Клетка цели + клетки траектории толчка за целью.
      const pushDx = Math.sign(hoveredTarget.x - caster.x);
      const pushDy = Math.sign(hoveredTarget.y - caster.y);
      const positions: Position[] = [{ x: hoveredTarget.x, y: hoveredTarget.y }];
      for (let i = 1; i <= params.pushDistance; i++) {
        positions.push({ x: hoveredTarget.x + pushDx * i, y: hoveredTarget.y + pushDy * i });
      }
      return positions;
    },

    resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
      return resolveThrowIntents(state, caster, targets, this.id);
    },
  };
}
