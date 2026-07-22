import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {getVisiblePositionsWithinRange} from '@simulation/skills/targeting';

export const rainSkill: SkillExecutor = {
  id: 'rain',

  getTargetMode(): TargetMode {
    return { type: 'single', range: 5 };
  },

  getValidTargets(state: GameState, caster: Entity): Position[] {
    return getVisiblePositionsWithinRange(state, caster, 5);
  },

  preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
    if (!hoveredTarget) return [];
    return this.resolve(state, caster, [hoveredTarget]);
  },

  getAffectedPositions(_state: GameState, _caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
    if (!hoveredTarget) return [];
    return [hoveredTarget];
  },

  resolve(state: GameState, _caster: Entity, targets: Position[]): Intent[] {
    const target = targets[0];
    if (!target) return [];

    const { x, y } = target;
    if (state.map.tiles[y]?.[x] !== 'floor') return [];

    return [
      {
        type: 'SPAWN_TILE_EFFECT',
        effectType: 'water',
        position: { x, y },
      },
    ];
  },
};
