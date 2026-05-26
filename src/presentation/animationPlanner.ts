/**
 * Построитель дерева анимаций из дерева ExecutionNode.
 *
 * Ответственность:
 * - Обход дерева событий SimulationResult
 * - Преобразование GameEvent → AnimationNode (дерево)
 *
 * Правила:
 * - Не содержит игровой логики.
 * - Только перевод событий в декларативные анимации.
 * - Неанимированные события пропускаются; их дети поднимаются как сиблинги к ближайшему анимированному предку.
 */

import type { SimulationResult, GameEvent, GameState, TurnPhase } from '@simulation/types';
import type { ExecutionNode } from '@simulation/systems/actions/types';
import type { AnimationStep, AnimationNode } from './types';
import { filterByFOV } from './fogFilter';

type AnimationBuilder = (event: GameEvent, childNodes: AnimationNode[]) => AnimationNode[] | null;

const builders = new Map<string, AnimationBuilder>();

/** Зарегистрировать builder для конкретного типа GameEvent.
 *  Используется для расширения системы новыми анимациями без правки ядра. */
export function registerAnimationBuilder(eventType: string, builder: AnimationBuilder): void {
  builders.set(eventType, builder);
}

// ── Стандартные builders ───────────────────────────────────────────

registerAnimationBuilder('ENTITY_MOVED', (event, children) => {
  if (event.type !== 'ENTITY_MOVED') return null;
  return [{
    step: {
      type: 'MOVE',
      entityId: event.entityId,
      from: event.from,
      to: event.to,
    },
    children,
  }];
});

registerAnimationBuilder('ACTION_APPLIED', (event, children) => {
  if (event.type !== 'ACTION_APPLIED') return null;
  const action = event.action;
  if (action.type === 'ATTACK') {
    return [{
      step: {
        type: 'ATTACK',
        attackerId: action.entityId,
        dx: action.dx,
        dy: action.dy,
      },
      children,
    }];
  }
  return null;
});

registerAnimationBuilder('ENTITY_DAMAGED', (event, children) => {
  if (event.type !== 'ENTITY_DAMAGED') return null;
  return [{
    step: {
      type: 'DAMAGE',
      targetId: event.targetId,
      amount: event.damage,
      position: event.position,
    },
    children,
  }];
});

registerAnimationBuilder('ENTITY_DIED', (event, children) => {
  if (event.type !== 'ENTITY_DIED') return null;
  return [{
    step: {
      type: 'DEATH',
      entityId: event.entityId,
    },
    children,
  }];
});

registerAnimationBuilder('FOG_UPDATED', (event, children) => {
  if (event.type !== 'FOG_UPDATED') return null;
  return [{
    step: {
      type: 'FOG_UPDATE',
      newlyVisible: event.newlyVisible,
    },
    children,
  }];
});

registerAnimationBuilder('ABILITY_USED', (event, children) => {
  if (event.type !== 'ABILITY_USED') return null;

  const castStep: AnimationStep = {
    type: 'ABILITY_CAST',
    entityId: event.entityId,
    abilityId: event.abilityId,
    targets: event.targets,
    from: event.from,
  };

  if (event.abilityId === 'fireball') {
    const target = event.targets[0];
    if (target) {
      return [{
        step: castStep,
        children: [{
          step: { type: 'PROJECTILE', from: event.from, to: target },
          children: [{
            step: { type: 'EXPLOSION', center: target, radius: 1 },
            children,
          }],
        }],
      }];
    }
  }

  return [{ step: castStep, children }];
});

// ── Построение дерева ──────────────────────────────────────────────

export function buildAnimationTree(result: SimulationResult, state: GameState): AnimationNode[][] {
  const filtered = filterByFOV(result, state);
  const phases: AnimationNode[][] = [];

  let i = 0;
  while (i < filtered.phases.length) {
    const phase = filtered.phases[i]!;
    const phaseNodes: AnimationNode[] = [];
    for (const action of phase.actions) {
      phaseNodes.push(...convertExecutionNode(action));
    }

    // Если первый экшн игрока — MOVE, анимации окружения идут параллельно
    if (
      phase.side === 'PLAYER' &&
      isFirstActionMove(phase) &&
      i + 1 < filtered.phases.length &&
      filtered.phases[i + 1]!.side === 'ENVIRONMENT'
    ) {
      for (const action of filtered.phases[i + 1]!.actions) {
        phaseNodes.push(...convertExecutionNode(action));
      }
      i += 2;
    } else {
      i += 1;
    }

    if (phaseNodes.length > 0) {
      phases.push(phaseNodes);
    }
  }

  return phases;
}

function isFirstActionMove(phase: TurnPhase): boolean {
  const firstAction = phase.actions[0];
  if (!firstAction) return false;
  const event = firstAction.event;
  return event.type === 'ACTION_APPLIED' && event.action.type === 'MOVE';
}

/** Рекурсивно конвертирует ExecutionNode в AnimationNode[].
 *  Если текущее событие не маппится в шаг — узел "растворяется",
 *  а его дети поднимаются как сиблинги к ближайшему анимированному предку. */
function convertExecutionNode(node: ExecutionNode): AnimationNode[] {
  const builder = builders.get(node.event.type);

  const childNodes: AnimationNode[] = [];
  for (const child of node.children) {
    childNodes.push(...convertExecutionNode(child));
  }

  if (builder) {
    const nodes = builder(node.event, childNodes);
    if (nodes) return nodes;
  }

  return childNodes;
}
