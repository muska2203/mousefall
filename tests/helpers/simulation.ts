/**
 * Хелперы для создания GameSimulation в юнит-тестах.
 */

import { GameSimulation, defaultActionHandlerRegistry } from '../../src/simulation/simulation';
import type { GameState, SimulationResult } from '../../src/simulation/types';
import type { DebugContext } from '../../src/simulation/systems/actions/debug-add-item-action';
import { GameSession } from '../../src/presentation/gameSession';

/**
 * Создаёт GameSimulation для тестов и инициализирует turnState так,
 * чтобы сразу начинался ход игрока.
 *
 * Используется в тестах, где симуляция создаётся вручную (не через createNewGame).
 * Без инициализации turnState dispatch будет отклонять действия как "not_actor_turn".
 */
export function createTestSimulation(state: GameState, debugEnabled = false): GameSimulation {
  const debugContext: DebugContext = { enabled: debugEnabled };
  const sim = new GameSimulation(
    state,
    defaultActionHandlerRegistry(debugContext),
    undefined,
    debugContext,
  );
  sim.initializeTestTurnState('player', state.player.id);
  return sim;
}

/**
 * Прокручивает фазы до возвращения хода игрока.
 * Возвращает все результаты step(), включая последний player FACTION_SETUP.
 */
export function advanceToPlayerTurn(sim: GameSimulation): SimulationResult[] {
  const results: SimulationResult[] = [];
  do {
    results.push(sim.step());
  } while (!sim.isPlayerTurn());
  return results;
}

/**
 * Дожидается завершения всех анимаций в GameSession.
 * Необходим, потому что после END_TURN игрока запускаются анимации ходов AI,
 * и одного вызова onAnimationsComplete может быть недостаточно.
 */
export function drainAnimations(session: GameSession, maxSteps = 20): void {
  for (let i = 0; i < maxSteps; i++) {
    const phase = session.getViewModel().renderInput?.phase;
    if (phase !== 'animating') break;
    session.onAnimationsComplete();
  }
}
