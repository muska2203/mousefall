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

import type { SimulationResult, GameEvent } from '@simulation/types';
import type { ExecutionNode } from '@simulation/systems/actions/types';
import type { AnimationStep, AnimationNode } from './types';

type StepBuilder = (event: GameEvent) => AnimationStep | null;

const builders = new Map<string, StepBuilder>();

/** Зарегистрировать builder для конкретного типа GameEvent.
 *  Используется для расширения системы новыми анимациями без правки ядра. */
export function registerAnimationBuilder(eventType: string, builder: StepBuilder): void {
  builders.set(eventType, builder);
}

// ── Стандартные builders ───────────────────────────────────────────

registerAnimationBuilder('ENTITY_MOVED', (event) => {
  if (event.type !== 'ENTITY_MOVED') return null;
  return {
    type: 'MOVE',
    entityId: event.entityId,
    from: event.from,
    to: event.to,
  };
});

registerAnimationBuilder('ENTITY_ATTACKED', (event) => {
  if (event.type !== 'ENTITY_ATTACKED') return null;
  return {
    type: 'ATTACK',
    attackerId: event.attackerId,
    dx: event.dx,
    dy: event.dy,
  };
});

registerAnimationBuilder('ENTITY_DAMAGED', (event) => {
  if (event.type !== 'ENTITY_DAMAGED') return null;
  return {
    type: 'DAMAGE',
    targetId: event.targetId,
    amount: event.damage,
    position: event.position,
  };
});

registerAnimationBuilder('ENTITY_DIED', (event) => {
  if (event.type !== 'ENTITY_DIED') return null;
  return {
    type: 'DEATH',
    entityId: event.entityId,
  };
});

registerAnimationBuilder('FOG_UPDATED', (event) => {
  if (event.type !== 'FOG_UPDATED') return null;
  return {
    type: 'FOG_UPDATE',
    newlyVisible: event.newlyVisible,
  };
});

// ── Построение дерева ──────────────────────────────────────────────

export function buildAnimationTree(result: SimulationResult): AnimationNode[] {
  const roots: AnimationNode[] = [];
  for (const phase of result.phases) {
    for (const action of phase.actions) {
      roots.push(...convertExecutionNode(action));
    }
  }
  return roots;
}

/** Рекурсивно конвертирует ExecutionNode в AnimationNode[].
 *  Если текущее событие не маппится в шаг — узел "растворяется",
 *  а его дети поднимаются как сиблинги к родителю (flatten up). */
function convertExecutionNode(node: ExecutionNode): AnimationNode[] {
  const builder = builders.get(node.event.type);
  const step = builder ? builder(node.event) : null;

  const childNodes: AnimationNode[] = [];
  for (const child of node.children) {
    childNodes.push(...convertExecutionNode(child));
  }

  if (step) {
    return [{ step, children: childNodes }];
  }

  return childNodes;
}
