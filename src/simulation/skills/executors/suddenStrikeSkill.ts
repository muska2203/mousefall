import {Entity, GameState, Position, StatusEffect} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {findAllEntitiesAt, isCombatEntity} from '@simulation/state';
import {isEnemyEntity} from '@simulation/ai/ai-state';
import {rollWeaponDamage} from '@simulation/systems/stats/weapon-damage-roll';
import {getAbilityTags} from '@simulation/systems/tags/ability-tags';
import {getPrimaryDamageTag, getWeaponTags} from '@simulation/systems/tags/weapon-tags';
import {mergeDamageIntentTags} from '@simulation/systems/tags/tag-helpers';

/** Параметры исполнителя способности вида «внезапный удар» (соответствуют полям шаблона kind 'suddenStrike'). */
export interface SuddenStrikeSkillParams {
  /** Контентный id способности (шаблона). */
  id: string;
  /** Длительность немоты (в ходах), накладываемой на цель с подготовленной способностью. */
  silenceDuration: number;
}

/**
 * Восемь соседних смещений вокруг клетки кастующего.
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

/**
 * Фабрика исполнителя способности вида «внезапный удар»:
 * удар оружием по соседней цели; если цель — враг с подготовленной
 * способностью, дополнительно накладывает немоту на silenceDuration ходов.
 *
 * Урон — ролл экипированного оружия (механика оружейного скилла,
 * параметром шаблона не является).
 *
 * Параметры механики приходят из шаблона способности (kind 'suddenStrike'),
 * сборку и кэширование выполняет getSkillExecutor.
 */
export function createSuddenStrikeSkill(params: SuddenStrikeSkillParams): SkillExecutor {
  return {
    id: params.id,

    getTargetMode(): TargetMode {
      return { type: 'single', range: 1 };
    },

    getValidTargets(state: GameState, caster: Entity): Position[] {
      const positions: Position[] = [];

      for (const { ox, oy } of NEIGHBOR_OFFSETS) {
        const x = caster.x + ox;
        const y = caster.y + oy;

        if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
          continue;
        }

        // Валидными являются только клетки с живыми combat-акторами, кроме самого кастера.
        const entitiesAtTile = findAllEntitiesAt(state, x, y);
        const hasAliveCombatTarget = entitiesAtTile.some(
          e => e.id !== caster.id && isCombatEntity(e) && e.isAlive,
        );

        if (hasAliveCombatTarget) {
          positions.push({ x, y });
        }
      }

      return positions;
    },

    getCastableCells(state: GameState, caster: Entity): Position[] {
      // Паттерн прицеливания: все 8 соседних клеток в пределах карты,
      // независимо от наличия целей.
      const positions: Position[] = [];

      for (const { ox, oy } of NEIGHBOR_OFFSETS) {
        const x = caster.x + ox;
        const y = caster.y + oy;

        if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
          continue;
        }

        positions.push({ x, y });
      }

      return positions;
    },

    preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
      if (!hoveredTarget) return [];
      return this.resolve(state, caster, [hoveredTarget]);
    },

    getAffectedPositions(
      _state: GameState,
      _caster: Entity,
      _selectedTargets: Position[],
      hoveredTarget: Position | null,
    ): Position[] {
      if (!hoveredTarget) return [];
      return [{ x: hoveredTarget.x, y: hoveredTarget.y }];
    },

    resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
      const targetPos = targets[0];
      if (!targetPos) return [];

      const target = findAllEntitiesAt(state, targetPos.x, targetPos.y)
        .find(e => isCombatEntity(e) && e.isAlive);
      if (!target) return [];

      const damage = rollWeaponDamage(state, caster);
      const primaryTag = getPrimaryDamageTag(caster);
      const tags = mergeDamageIntentTags([primaryTag], getAbilityTags(this.id), getWeaponTags(caster));

      const intents: Intent[] = [{
        type: 'DAMAGE' as const,
        entityId: target.id,
        sourceEntityId: caster.id,
        damage,
        tags,
      }];

      // Если цель — враг с подготовленной способностью, накладываем немоту.
      if (isEnemyEntity(target) && target.aiState.preparedAbility) {
        const silenced: StatusEffect = {
          type: 'silenced',
          duration: params.silenceDuration,
          value: 0,
          statModifiers: null,
        };
        intents.push({ type: 'APPLY_STATUS', entityId: target.id, sourceEntityId: caster.id, status: silenced });
      }

      return intents;
    },
  };
}
