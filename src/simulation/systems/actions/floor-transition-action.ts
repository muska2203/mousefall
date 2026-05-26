/**
 * Action handlers DESCEND / ASCEND.
 *
 * WorldReaction stairsTransitionReaction только обнаруживает лестницу и порождает
 * STAIR_EXIT_TRIGGERED — решение о переходе принимает Presentation.
 */

import type { GameState, ValidationResult } from '@simulation/types';
import { ActionHandler } from './types';
import { executeIntent } from '@simulation/systems/intents/execute-intent';
import { findStairsAt } from '@simulation/state';
import { MAX_FLOOR } from '@utils/constants';
import { performFloorTransition } from './floor-transition-logic';

// ─────────────────────────────────────────────
// Action handlers
// ─────────────────────────────────────────────

export const descendAction: ActionHandler = {
  validate(state: GameState, action): ValidationResult {
    if (action.type !== 'DESCEND') {
      return { ok: false, reasonCode: 'wrong_action_type', reasonDescription: 'Expected DESCEND action' };
    }
    const entity = state.entities.get(action.entityId);
    if (!entity || entity.id !== 'player') {
      return { ok: false, reasonCode: 'entity_not_player', reasonDescription: 'Только игрок может спускаться' };
    }

    const stairs = findStairsAt(state, entity.x, entity.y, 'down');
    if (!stairs) {
      return { ok: false, reasonCode: 'no_stairs_down', reasonDescription: 'Здесь нет спуска вниз' };
    }

    if (state.floor >= MAX_FLOOR) {
      return { ok: false, reasonCode: 'max_floor_reached', reasonDescription: 'Достигнут нижний этаж подземелья' };
    }

    return { ok: true };
  },

  resolve(): [{ type: 'CHANGE_FLOOR'; direction: 'down' }] {
    return [{ type: 'CHANGE_FLOOR', direction: 'down' }];
  },

  execute(
    state: GameState,
    _action,
    intents: [{ type: 'CHANGE_FLOOR'; direction: 'down' }],
    executionBuilder,
    parentNode,
  ): void {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};

export const ascendAction: ActionHandler = {
  validate(state: GameState, action): ValidationResult {
    if (action.type !== 'ASCEND') {
      return { ok: false, reasonCode: 'wrong_action_type', reasonDescription: 'Expected ASCEND action' };
    }
    const entity = state.entities.get(action.entityId);
    if (!entity || entity.id !== 'player') {
      return { ok: false, reasonCode: 'entity_not_player', reasonDescription: 'Только игрок может подниматься' };
    }

    const stairs = findStairsAt(state, entity.x, entity.y, 'up');
    if (!stairs) {
      return { ok: false, reasonCode: 'no_stairs_up', reasonDescription: 'Здесь нет подъёма вверх' };
    }

    if (state.floor <= 1) {
      return { ok: false, reasonCode: 'min_floor_reached', reasonDescription: 'Вы уже на поверхности' };
    }

    return { ok: true };
  },

  resolve(): [{ type: 'CHANGE_FLOOR'; direction: 'up' }] {
    return [{ type: 'CHANGE_FLOOR', direction: 'up' }];
  },

  execute(
    state: GameState,
    _action,
    intents: [{ type: 'CHANGE_FLOOR'; direction: 'up' }],
    executionBuilder,
    parentNode,
  ): void {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};
