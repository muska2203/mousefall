/**
 * Фильтрация SimulationResult по полю зрения игрока (FOV).
 *
 * Ответственность:
 * - Определение видимости событий для игрока на основе state.visible
 * - Фильтрация деревьев ExecutionNode: невидимые узлы удаляются,
 *   их видимые дети поднимаются (flatten up).
 *
 * Правила:
 * - Чистое преобразование: не мутирует входные данные.
 * - Simulation генерирует полное дерево событий; этот модуль решает,
 *   что из него попадёт в анимации.
 */

import type { GameState, SimulationResult, TurnPhase, GameEvent } from '@simulation/types';
import type { ExecutionNode } from '@simulation/systems/actions/types';

/** Отфильтровать SimulationResult, оставив только видимые игроку события. */
export function filterByFOV(result: SimulationResult, state: GameState): SimulationResult {
  const phases: TurnPhase[] = [];
  for (const phase of result.phases) {
    const filteredActions = filterExecutionNodes(phase.actions, state);
    if (filteredActions.length > 0) {
      phases.push({ side: phase.side, actions: filteredActions });
    }
  }
  return { ...result, phases };
}

/** Проверить, видит ли игрок данное событие. */
export function isEventVisible(event: GameEvent, state: GameState): boolean {
  switch (event.type) {
    case 'ENTITY_MOVED': {
      return isPosVisible(event.from, state) || isPosVisible(event.to, state);
    }
    case 'ENTITY_DAMAGED':
    case 'ENTITY_DIED': {
      return isPosVisible(event.position, state);
    }
    case 'ENTITY_MISSED': {
      const attacker = state.entities.get(event.attackerId);
      const target = state.entities.get(event.targetId);
      return (
        (attacker !== undefined && isPosVisible(attacker, state)) ||
        (target !== undefined && isPosVisible(target, state))
      );
    }
    case 'ABILITY_USED': {
      return (
        isPosVisible(event.from, state) ||
        event.targets.some((t) => isPosVisible(t, state))
      );
    }
    case 'ACTION_APPLIED': {
      const action = event.action;
      if (action.type === 'ATTACK') {
        const actor = state.entities.get(action.entityId);
        if (!actor) return false;
        const targetPos = { x: actor.x + action.dx, y: actor.y + action.dy };
        return isPosVisible(actor, state) || isPosVisible(targetPos, state);
      }
      // Для остальных типов корень "растворится" в animationPlanner,
      // но пропускаем его, чтобы дети могли подняться
      return true;
    }
    case 'FOG_UPDATED':
      return true;
    case 'STATUS_TICKED':
    case 'STATUS_APPLIED':
    case 'STATUS_REMOVED': {
      const entity = state.entities.get(event.entityId);
      return entity !== undefined && isPosVisible(entity, state);
    }
    case 'PLAYER_DIED':
      return true;
    case 'ITEM_PICKED_UP':
    case 'ITEM_USED': {
      const entity = state.entities.get(event.entityId);
      return entity !== undefined && isPosVisible(entity, state);
    }
    case 'ITEM_DROPPED':
    case 'DOOR_OPENED':
    case 'DOOR_CLOSED': {
      return isPosVisible(event.position, state);
    }
    case 'STAIR_EXIT_TRIGGERED':
    case 'FLOOR_CHANGED':
    case 'TURN_ENDED':
    case 'PLAYER_LEVELED_UP':
      return true;
    case 'RESOURCE_CONSUMED': {
      const entity = state.entities.get(event.entityId);
      return entity !== undefined && isPosVisible(entity, state);
    }
    case 'ACTION_REJECTED':
      return true;
    default:
      return true;
  }
}

function filterExecutionNodes(nodes: ExecutionNode[], state: GameState): ExecutionNode[] {
  const result: ExecutionNode[] = [];
  for (const node of nodes) {
    const filteredChildren = filterExecutionNodes(node.children, state);
    const visible = isEventVisible(node.event, state);

    if (visible) {
      result.push({
        event: node.event,
        parent: null,
        children: filteredChildren,
      });
    } else if (filteredChildren.length > 0) {
      // Невидимый узел, но есть видимые дети — поднимаем детей
      result.push(...filteredChildren);
    }
    // Если невидим и детей нет — пропускаем
  }
  return result;
}

function isPosVisible(pos: { x: number; y: number }, state: GameState): boolean {
  const { width, height } = state.map;
  if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) {
    return false;
  }
  return state.visible[pos.y]?.[pos.x] ?? false;
}
