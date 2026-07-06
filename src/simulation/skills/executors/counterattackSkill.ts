import { GameState, Position, Entity } from '@simulation/types';
import { Intent } from '@simulation/systems/intents/types';
import { TargetMode } from '@simulation/core-types';
import { SkillExecutor } from '@simulation/skills/skillExecutor';
import { isActor } from '@simulation/state';

/**
 * Скилл "Контратака".
 *
 * Механика:
 * - Цель — сам кастер (self).
 * - Фиксированная стоимость 2 AP, кулдаун 4 хода.
 * - Накладывает статус counterattack на 2 хода.
 * - Статус бинарный (без стаков).
 * - Статус тикает перед ходом фракции его носителя (duration = число тиков).
 */
export const counterattackSkill: SkillExecutor = {
  id: 'counterattack',

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
        status: {
          type: 'counterattack',
          duration: 2,
          value: 0,
          statModifiers: null,
        },
      },
    ];
  },
};
