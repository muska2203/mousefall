import { GameState, Position, Entity } from '@simulation/types';
import { Intent } from '@simulation/systems/intents/types';
import { TargetMode } from '@simulation/core-types';
import { SkillExecutor } from '@simulation/skills/skillExecutor';
import { isActor } from '@simulation/state';
import { MAX_ABILITY_ALL_AP_COST } from '@utils/constants';

/**
 * Скилл "Парирование".
 *
 * Механика:
 * - Цель — сам кастер (self).
 * - При касте тратятся текущие AP кастера, но не более MAX_ABILITY_ALL_AP_COST.
 * - Накладывает статус parry на 1 ход, количество стаков = потраченным AP.
 * - Статус тикает в зависимости от стороны кастера:
 *   - игрок кастует → tickAfter: 'environment' (активен во время хода врагов);
 *   - враг кастует → tickAfter: 'player' (активен во время хода игрока).
 */
export const parrySkill: SkillExecutor = {
  id: 'parry',

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

    const stacks = Math.min(caster.ap, MAX_ABILITY_ALL_AP_COST);
    const tickAfter = caster.type === 'player' ? 'environment' : 'player';

    return [
      {
        type: 'APPLY_STATUS',
        entityId: caster.id,
        status: {
          type: 'parry',
          duration: 1,
          value: 0,
          statModifiers: null,
          stacks,
          tickAfter,
        },
      },
    ];
  },
};
