import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {getEntitiesInRadius} from '@simulation/skills/targeting';
import {isBlocked, isCombatEntity, isDamageable, isTerrainWalkable} from '@simulation/state';
import {getAbilityTags, getSkillDamageTag} from '@simulation/systems/tags/ability-tags';
import {mergeDamageIntentTags} from '@simulation/systems/tags/tag-helpers';
import {tryGetAbility} from '@content/registry';

/** Параметры исполнителя способности вида «налёт» (соответствуют полям шаблона kind 'swoop'). */
export interface SwoopSkillParams {
  /** Контентный id способности (шаблона). */
  id: string;
  /** Радиус выбора точки приземления относительно кастера. */
  jumpRadius: number;
  /** Радиус удара по земле вокруг точки приземления. */
  aoeRadius: number;
  /** Базовый урон от удара по земле. */
  baseDamage: number;
}

/**
 * Фабрика исполнителя способности вида «налёт»:
 * прыжок в свободную клетку в радиусе jumpRadius, площадной урон
 * по квадрату aoeRadius вокруг точки приземления и отталкивание целей.
 *
 * Параметры механики приходят из шаблона способности (kind 'swoop'),
 * сборку и кэширование выполняет getSkillExecutor.
 */
export function createSwoopSkill(params: SwoopSkillParams): SkillExecutor {
  /**
   * Возвращает клетки, в которые кастер может приземлиться:
   * не стены, не занятые непроходимыми объектами, в пределах радиуса прыжка.
   */
  function getJumpTargets(state: GameState, caster: Entity): Position[] {
    const positions: Position[] = [];

    for (let dy = -params.jumpRadius; dy <= params.jumpRadius; dy++) {
      for (let dx = -params.jumpRadius; dx <= params.jumpRadius; dx++) {
        if (dx === 0 && dy === 0) continue;

        const x = caster.x + dx;
        const y = caster.y + dy;

        if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) continue;
        if (!isTerrainWalkable(state.map.tiles[y]?.[x])) continue;
        if (isBlocked(state, x, y)) continue;

        positions.push({ x, y });
      }
    }

    return positions;
  }

  /**
   * Проверяет, что выбранная точка является допустимой для приземления.
   */
  function isValidJumpTarget(state: GameState, caster: Entity, target: Position): boolean {
    if (
      target.x < 0 ||
      target.x >= state.map.width ||
      target.y < 0 ||
      target.y >= state.map.height
    ) {
      return false;
    }

    if (!isTerrainWalkable(state.map.tiles[target.y]?.[target.x])) return false;
    if (isBlocked(state, target.x, target.y)) return false;

    const dx = target.x - caster.x;
    const dy = target.y - caster.y;
    if (dx === 0 && dy === 0) return false;
    return !(Math.abs(dx) > params.jumpRadius || Math.abs(dy) > params.jumpRadius);


  }

  /**
   * Разрешает способность в набор интентов.
   */
  function resolveSwoopIntents(state: GameState, caster: Entity, targets: Position[], skillId: string): Intent[] {
    if (!isCombatEntity(caster)) return [];

    const target = targets[0];
    if (!target) return [];
    if (!isValidJumpTarget(state, caster, target)) return [];

    const intents: Intent[] = [];
    const ability = tryGetAbility(skillId);
    const damageTag = getSkillDamageTag(ability);
    const abilityTags = getAbilityTags(skillId);

    // Прыжок в выбранную точку.
    intents.push({
      type: 'JUMP',
      entityId: caster.id,
      dx: target.x - caster.x,
      dy: target.y - caster.y,
    });

    // Удар по земле: плоский урон по клеткам вокруг точки приземления.
    for (let dy = -params.aoeRadius; dy <= params.aoeRadius; dy++) {
      for (let dx = -params.aoeRadius; dx <= params.aoeRadius; dx++) {
        const x = target.x + dx;
        const y = target.y + dy;

        if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) continue;

        const tags = damageTag
          ? mergeDamageIntentTags([damageTag], abilityTags)
          : abilityTags;
        intents.push({
          type: 'DAMAGE_TILE',
          position: { x, y },
          sourceEntityId: caster.id,
          damage: params.baseDamage,
          tags,
        });
      }
    }

    // Отталкивание всем живым объектам с hp в радиусе.
    const affectedEntities = getEntitiesInRadius(state, target, params.aoeRadius);
    for (const entity of affectedEntities) {
      if (entity.id === caster.id) continue;
      if (!isDamageable(entity)) continue;

      const pushDx = Math.sign(entity.x - target.x);
      const pushDy = Math.sign(entity.y - target.y);

      if (pushDx !== 0 || pushDy !== 0) {
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
      return { type: 'single', range: params.jumpRadius };
    },

    getValidTargets(state: GameState, caster: Entity): Position[] {
      return getJumpTargets(state, caster);
    },

    preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
      if (!hoveredTarget) return [];
      return resolveSwoopIntents(state, caster, [hoveredTarget], this.id);
    },

    getAffectedPositions(_state: GameState, _caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
      if (!hoveredTarget) return [];

      const positions: Position[] = [];
      for (let dy = -params.aoeRadius; dy <= params.aoeRadius; dy++) {
        for (let dx = -params.aoeRadius; dx <= params.aoeRadius; dx++) {
          positions.push({ x: hoveredTarget.x + dx, y: hoveredTarget.y + dy });
        }
      }
      return positions;
    },

    resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
      return resolveSwoopIntents(state, caster, targets, this.id);
    },
  };
}
