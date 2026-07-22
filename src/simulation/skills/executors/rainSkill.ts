import {Entity, GameState, Position} from '@simulation/types';
import {Intent} from '@simulation/systems/intents/types';
import {TargetMode} from '@simulation/core-types';
import {SkillExecutor} from '@simulation/skills/skillExecutor';
import {getVisiblePositionsWithinRange, getPositionsInRadius} from '@simulation/skills/targeting';

/** Радиус дождя. 0 — только клетка цели. */
const RAIN_RADIUS = 1;

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

  getAffectedPositions(state: GameState, _caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
    if (!hoveredTarget) return [];
    return getPositionsInRadius(state, hoveredTarget, RAIN_RADIUS)
      .filter(pos => state.map.tiles[pos.y]?.[pos.x] === 'floor');
  },

  resolve(state: GameState, _caster: Entity, targets: Position[]): Intent[] {
    const target = targets[0];
    if (!target) return [];

    return getPositionsInRadius(state, target, RAIN_RADIUS)
      .filter(pos => state.map.tiles[pos.y]?.[pos.x] === 'floor')
      .map(pos => ({
        type: 'SPAWN_TILE_EFFECT',
        effectType: 'water',
        position: pos,
      }));
  },
};
