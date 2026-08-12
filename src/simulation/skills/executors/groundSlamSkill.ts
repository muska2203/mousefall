import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {GameplayTag, TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {damageFormulas} from '@simulation/skills/damageFormula';
import {getEntitiesInRadius} from '@simulation/skills/targeting';
import {isCombatEntity, isDamageable} from '@simulation/state';
import {getAbilityTags} from '@simulation/systems/tags/ability-tags';
import {mergeDamageIntentTags} from '@simulation/systems/tags/tag-helpers';

/** Параметры исполнителя способности вида «удар по земле» (соответствуют полям шаблона kind 'groundSlam'). */
export interface GroundSlamSkillParams {
  /** Контентный id способности (шаблона). */
  id: string;
  /** Радиус удара по земле вокруг кастера (квадрат по Чебышёву). */
  radius: number;
  /** Базовый урон от удара по земле. */
  baseDamage: number;
}

/**
 * Фабрика исполнителя способности вида «удар по земле»:
 * площадной урон по квадрату (2·radius+1)² вокруг актуальной позиции кастера
 * по всем существам, кроме самого кастера (friendly fire допустим).
 *
 * Интенты урона несут тег `skill.<id>` — на него опираются контентные правила
 * вида «накладывать статус выжившим» (например, ground_slam_daze).
 *
 * Параметры механики приходят из шаблона способности (kind 'groundSlam'),
 * сборку и кэширование выполняет getSkillExecutor.
 */
export function createGroundSlamSkill(params: GroundSlamSkillParams): SkillExecutor {
  /**
   * Возвращает уровень скилла у кастера.
   */
  function getSkillLevel(caster: Entity): number {
    if (caster.type !== 'player') return 1;
    return caster.abilities.find(a => a.templateId === params.id)?.level ?? 1;
  }

  /**
   * Разрешает способность в набор интентов.
   */
  function resolveGroundSlamIntents(state: GameState, caster: Entity, skillId: string): Intent[] {
    if (!isCombatEntity(caster)) return [];

    const formula = damageFormulas['ground_slam'];
    if (!formula) return [];

    const intents: Intent[] = [];
    const skillLevel = getSkillLevel(caster);
    const abilityTags = getAbilityTags(skillId);
    // Тег идентичности способности — маркер урона для контентных правил (ground_slam_daze).
    const skillTag = `skill.${skillId}` as GameplayTag;

    const affectedEntities = getEntitiesInRadius(state, { x: caster.x, y: caster.y }, params.radius);
    for (const entity of affectedEntities) {
      if (entity.id === caster.id) continue;
      if (!isDamageable(entity)) continue;

      const damageEntries = formula({
        caster,
        skillLevel,
        baseDamage: params.baseDamage,
      });

      for (const entry of damageEntries) {
        intents.push({
          type: 'DAMAGE',
          entityId: entity.id,
          sourceEntityId: caster.id,
          damage: entry.damage,
          tags: mergeDamageIntentTags(entry.tags, abilityTags, [skillTag]),
        });
      }
    }

    return intents;
  }

  return {
    id: params.id,

    getTargetMode(): TargetMode {
      return { type: 'self' };
    },

    getValidTargets(_state: GameState, caster: Entity): Position[] {
      return [{ x: caster.x, y: caster.y }];
    },

    preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
      if (!hoveredTarget) return [];
      return resolveGroundSlamIntents(state, caster, this.id);
    },

    getAffectedPositions(_state: GameState, caster: Entity, _selectedTargets: Position[], _hoveredTarget: Position | null): Position[] {
      // Квадрат (2·radius+1)² от актуальной позиции кастера — зона телеграфа.
      const positions: Position[] = [];
      for (let dy = -params.radius; dy <= params.radius; dy++) {
        for (let dx = -params.radius; dx <= params.radius; dx++) {
          positions.push({ x: caster.x + dx, y: caster.y + dy });
        }
      }
      return positions;
    },

    resolve(state: GameState, caster: Entity, _targets: Position[]): Intent[] {
      return resolveGroundSlamIntents(state, caster, this.id);
    },
  };
}
