/**
 * Исполнитель интента FLOOR_TRANSITION.
 *
 * Контракт:
 * - Вычисляет план перехода между этажами через computeFloorTransition.
 * - Мутирует только `state.floor` — остальные изменения состояния выполняются
 *   каноническими intent executor-ами через world reaction на `FLOOR_CHANGED`.
 * - Порождает единственное событие `FLOOR_CHANGED`, содержащее план.
 */

import type {GameState} from '@simulation/types';
import type {ExecutionBuilder, ExecutionNode, FloorTransitionIntent} from '@simulation/core-types';
import type {IntentExecutor} from './types';
import {computeFloorTransition} from '@simulation/systems/floor-transition-planner';

export const executeFloorTransitionIntent: IntentExecutor<FloorTransitionIntent> = (
  state: GameState,
  intent: FloorTransitionIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const plan = computeFloorTransition(state, intent.direction);
  state.floor = plan.to;

  return builder.addChild(parent, {
    type: 'FLOOR_CHANGED',
    from: plan.from,
    to: plan.to,
    plan,
  });
};
