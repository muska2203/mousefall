/**
 * Action handlers DESCEND / ASCEND.
 *
 * WorldReaction stairsTransitionReaction только обнаруживает лестницу и порождает
 * STAIR_EXIT_TRIGGERED — решение о переходе принимает Presentation.
 *
 * Переход на другой этаж оркестрируется через атомарные интенты:
 * FLOOR_CHANGED → SET_MAP → SET_ENTITIES → TELEPORT_ENTITY → BEGIN_TURN → RESTORE_AP → UPDATE_FOG.
 */

import type { GameState, ValidationResult, Entity, EntityId } from '@simulation/types';
import { ActionHandler } from './types';
import { executeIntent } from '@simulation/systems/intents/execute-intent';
import { findStairsAt } from '@simulation/state';
import { MAX_FLOOR } from '@utils/constants';
import { computeFloorTransition } from '@simulation/systems/floor-transition-planner';

// ─────────────────────────────────────────────
// Action handlers
// ─────────────────────────────────────────────

export const descendAction: ActionHandler = {
  validate(state: GameState, action): ValidationResult {
    if (action.type !== 'DESCEND') {
      return { ok: false, reasonCode: 'wrong_action_type' };
    }
    const entity = state.entities.get(action.entityId);
    if (!entity || entity.id !== 'player') {
      return { ok: false, reasonCode: 'entity_not_player' };
    }

    const stairs = findStairsAt(state, entity.x, entity.y, 'stairs_down');
    if (!stairs) {
      return { ok: false, reasonCode: 'no_stairs_down' };
    }

    if (state.floor >= MAX_FLOOR) {
      return { ok: false, reasonCode: 'max_floor_reached' };
    }

    return { ok: true };
  },

  resolve(): [] {
    return [];
  },

  execute(
    state: GameState,
    action,
    _intents,
    executionBuilder,
    parentNode,
  ): void {
    const direction = action.type === 'DESCEND' ? 'down' : 'up';
    const plan = computeFloorTransition(state, direction);

    // Номер этажа — мета-состояние перехода; сам факт фиксируется событием FLOOR_CHANGED.
    state.floor = plan.to;

    const floorNode = executionBuilder.addChild(parentNode, {
      type: 'FLOOR_CHANGED',
      from: plan.from,
      to: plan.to,
    });

    const subIntents = [
      { type: 'SET_MAP' as const, map: plan.map, explored: plan.explored },
      { type: 'SET_ENTITIES' as const, entities: plan.entities as Map<EntityId, unknown> },
      { type: 'TELEPORT_ENTITY' as const, entityId: 'player', x: plan.playerPosition.x, y: plan.playerPosition.y },
      { type: 'BEGIN_TURN' as const, side: 'PLAYER' as const, round: plan.turn.round },
      { type: 'RESTORE_AP' as const, entityId: 'player' },
      { type: 'UPDATE_FOG' as const },
    ] as const;

    for (const subIntent of subIntents) {
      executeIntent(state, subIntent, executionBuilder, floorNode);
    }
  },
};

export const ascendAction: ActionHandler = {
  validate(state: GameState, action): ValidationResult {
    if (action.type !== 'ASCEND') {
      return { ok: false, reasonCode: 'wrong_action_type' };
    }
    const entity = state.entities.get(action.entityId);
    if (!entity || entity.id !== 'player') {
      return { ok: false, reasonCode: 'entity_not_player' };
    }

    const stairs = findStairsAt(state, entity.x, entity.y, 'stairs_up');
    if (!stairs) {
      return { ok: false, reasonCode: 'no_stairs_up' };
    }

    if (state.floor <= 1) {
      return { ok: false, reasonCode: 'min_floor_reached' };
    }

    return { ok: true };
  },

  resolve(): [] {
    return [];
  },

  execute(
    state: GameState,
    action,
    _intents,
    executionBuilder,
    parentNode,
  ): void {
    const direction = action.type === 'ASCEND' ? 'up' : 'down';
    const plan = computeFloorTransition(state, direction);

    state.floor = plan.to;

    const floorNode = executionBuilder.addChild(parentNode, {
      type: 'FLOOR_CHANGED',
      from: plan.from,
      to: plan.to,
    });

    const subIntents = [
      { type: 'SET_MAP' as const, map: plan.map, explored: plan.explored },
      { type: 'SET_ENTITIES' as const, entities: plan.entities as Map<EntityId, unknown> },
      { type: 'TELEPORT_ENTITY' as const, entityId: 'player', x: plan.playerPosition.x, y: plan.playerPosition.y },
      { type: 'BEGIN_TURN' as const, side: 'PLAYER' as const, round: plan.turn.round },
      { type: 'RESTORE_AP' as const, entityId: 'player' },
      { type: 'UPDATE_FOG' as const },
    ] as const;

    for (const subIntent of subIntents) {
      executeIntent(state, subIntent, executionBuilder, floorNode);
    }
  },
};
