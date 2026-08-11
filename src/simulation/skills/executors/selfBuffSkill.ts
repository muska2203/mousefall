import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {StatusEffectType, TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {isActor} from '@simulation/state';

/** Параметры generic self-buff исполнителя (соответствуют полям вида `kind: 'selfBuff'` шаблона способности). */
export interface SelfBuffSkillParams {
  id: string;
  statusType: StatusEffectType;
  duration: number;
}

/**
 * Фабрика обобщённого исполнителя self-buff способности.
 *
 * Механика:
 * - Цель — сам кастер (self).
 * - Накладывает на кастера статус statusType на duration ходов.
 *
 * Вызывается из KIND_FACTORIES в getSkillExecutor для шаблонов вида `kind: 'selfBuff'`
 * (например, «Контратака» и «Глухая оборона»).
 */
export function createSelfBuffSkill(params: SelfBuffSkillParams): SkillExecutor {
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
      return this.resolve(state, caster, [hoveredTarget]);
    },

    getAffectedPositions(_state: GameState, caster: Entity, _selectedTargets: Position[], _hoveredTarget: Position | null): Position[] {
      return [{ x: caster.x, y: caster.y }];
    },

    resolve(_state: GameState, caster: Entity, _targets: Position[]): Intent[] {
      if (!isActor(caster)) {
        return [];
      }

      return [
        {
          type: 'APPLY_STATUS',
          entityId: caster.id,
          sourceEntityId: caster.id,
          status: {
            type: params.statusType,
            duration: params.duration,
            value: 0,
            statModifiers: null,
          },
        },
      ];
    },
  };
}
