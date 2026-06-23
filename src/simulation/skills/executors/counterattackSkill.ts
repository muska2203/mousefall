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
 * - При касте тратятся все текущие AP кастера.
 * - Накладывает статус counterattack на 1 ход, количество стаков = потраченным AP.
 * - Статус тикает в зависимости от стороны кастера:
 *   - игрок кастует → tickAfter: 'environment' (активен во время хода врагов);
 *   - враг кастует → tickAfter: 'player' (активен во время хода игрока).
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

    const stacks = caster.ap;
    const tickAfter = caster.type === 'player' ? 'environment' : 'player';

    return [
      {
        type: 'APPLY_STATUS',
        entityId: caster.id,
        status: {
          type: 'counterattack',
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
