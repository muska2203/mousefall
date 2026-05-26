/**
 * Построитель combat log из дерева ExecutionNode.
 *
 * Ответственность:
 * - Извлечение значимых для игрока событий из SimulationResult
 * - Преобразование GameEvent → строки лога
 *
 * Правила:
 * - Не содержит игровой логики.
 * - Только фильтрация и форматирование событий.
 */

import type {GameEvent, GameState, SimulationResult, TurnSide} from '@simulation/types';
import type {ExecutionNode} from '@simulation/systems/actions/types';



export function extractEvents(result: SimulationResult): GameEvent[] {
  const events: GameEvent[] = [];
  for (const phase of result.phases) {
    for (const action of phase.actions) {
      walkExecutionTree(action, events, phase.side);
    }
  }
  return events;
}

function walkExecutionTree(node: ExecutionNode, out: GameEvent[], side: TurnSide): void {
  if (side === 'PLAYER' || side === 'STATUS_TICK' || isEventRelevantToPlayer(node.event)) {
    out.push(node.event);
  }
  for (const child of node.children) {
    walkExecutionTree(child, out, side);
  }
}

function isEventRelevantToPlayer(event: GameEvent): boolean {
  switch (event.type) {
    case 'ENTITY_DAMAGED':
      return event.targetId === 'player';
    case 'PLAYER_DIED':
      return true;
    default:
      return false;
  }
}

export function gameEventToLog(
  state: GameState,
  event: GameEvent,
): { text: string; variant?: 'loot' | 'good' | 'bad' | 'info' } | null {
  switch (event.type) {
    case 'ENTITY_MOVED': {
      const name = getEntityDisplayName(state, event.entityId);
      return { text: `${name} переместился`, variant: 'info' };
    }
    case 'ACTION_APPLIED': {
      const action = event.action;
      if (action.type === 'ATTACK') {
        const name = getEntityDisplayName(state, action.entityId);
        return { text: `${name} атаковал`, variant: 'info' };
      }
      return null;
    }
    case 'ENTITY_DAMAGED': {
      const name = getEntityDisplayName(state, event.targetId);
      return {
        text: `${name} получил ${event.damage} урона`,
        variant: event.targetId === 'player' ? 'bad' : 'good',
      };
    }
    case 'ENTITY_DIED': {
      const name = getEntityDisplayName(state, event.entityId);
      return { text: `${name} погиб`, variant: 'bad' };
    }
    case 'PLAYER_DIED':
      return { text: 'Герой погиб', variant: 'bad' };
    default:
      return null;
  }
}

function getEntityDisplayName(state: GameState, entityId: string): string {
  const entity = state.entities.get(entityId);
  return entity?.displayName ?? (entityId === 'player' ? 'Герой' : 'Враг');
}
