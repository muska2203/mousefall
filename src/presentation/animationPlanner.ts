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
import type { AnimationStep, AnimationNode, AnimationPhase } from './types';
import { filterByFOV } from './fogFilter';

type AnimationBuilder = (event: GameEvent, childNodes: AnimationNode[], state: GameState) => AnimationNode[] | null;

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
      damageType: event.damageType,
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

registerAnimationBuilder('ITEM_DROPPED', (event, children) => {
  if (event.type !== 'ITEM_DROPPED') return null;
  return [{
    step: {
      type: 'ITEM_DROP',
      itemId: event.itemInstanceId,
      position: event.position,
      from: event.from,
      templateId: event.templateId,
    },
    children,
  }];
});

registerAnimationBuilder('CAST_RESOLVED', (event, children) => {
  if (event.type !== 'CAST_RESOLVED') return null;

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

registerAnimationBuilder('ENTITY_HEALED', (event) => {
  if (event.type !== 'ENTITY_HEALED') return null;
  return [{
    step: {
      type: 'UI_FLOATING_TEXT',
      text: `+${event.amount}`,
      x: event.position.x,
      y: event.position.y,
      styleKey: 'heal',
    },
    children: [],
  }];
});

registerAnimationBuilder('CAST_CANCELLED', (event) => {
  if (event.type !== 'CAST_CANCELLED') return null;
  return [{
    step: {
      type: 'UI_FLOATING_TEXT',
      textKey: 'system.animation.castInterrupted',
      x: event.from.x,
      y: event.from.y,
      styleKey: 'cast_cancel',
    },
    children: [],
  }];
});

registerAnimationBuilder('STATUS_APPLIED', (event, childNodes, state) => {
  if (event.type !== 'STATUS_APPLIED') return null;
  const entity = state.entities.get(event.entityId) ?? state.player;
  if (!entity) return null;
  return [{
    step: {
      type: 'STATUS_BURST',
      entityId: event.entityId,
      position: { x: entity.x, y: entity.y },
      statusType: event.effect.type,
    },
    children: childNodes,
  }];
});

registerAnimationBuilder('STATUS_TICKED', (event, childNodes, state) => {
  if (event.type !== 'STATUS_TICKED') return null;
  const entity = state.entities.get(event.entityId) ?? state.player;
  if (!entity) return null;
  return [{
    step: {
      type: 'STATUS_BURST',
      entityId: event.entityId,
      position: { x: entity.x, y: entity.y },
      statusType: 'ticked',
    },
    children: childNodes,
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

export function buildAnimationTree(result: SimulationResult, state: GameState): AnimationPhase[] {
  const filtered = filterByFOV(result, state);
  const phases: AnimationPhase[] = [];

  for (const phase of filtered.phases) {
    const phaseNodes: AnimationNode[] = [];
    for (const action of phase.actions) {
      phaseNodes.push(...convertExecutionNode(action, state));
    }

    const chainedNodes = chainNodesByEntity(phaseNodes);
    if (chainedNodes.length === 0) continue;

    // Ходы окружения разбиваем на подфазы по актёрам, чтобы враги ходили
    // последовательно друг за другом, а не параллельно.
    if (phase.side === 'ENVIRONMENT') {
      const subPhases = splitByActor(chainedNodes);
      for (const nodes of subPhases) {
        phases.push({ side: 'ENVIRONMENT', nodes, sequential: true });
      }
    } else {
      phases.push({ side: phase.side, nodes: chainedNodes });
    }
  }

  return phases;
}

/** Возвращает ID сущности, которой принадлежит анимационный узел, или null. */
function getNodeEntityId(node: AnimationNode): string | null {
  const step = node.step;
  switch (step.type) {
    case 'MOVE':
    case 'DEATH':
    case 'ABILITY_CAST':
    case 'STATUS_BURST':
      return step.entityId;
    case 'ATTACK':
      return step.attackerId;
    default:
      return null;
  }
}

/** Превращает последовательные корневые узлы одной сущности в цепочку parent → child.
 *  Нужно, чтобы sequencer не запускал их параллельно и не отменял предыдущую анимацию
 *  одного и того же спрайта (например, два MOVE врага за ход). */
function chainNodesByEntity(nodes: AnimationNode[]): AnimationNode[] {
  const roots: AnimationNode[] = [];
  const tails = new Map<string, AnimationNode>();

  for (const node of nodes) {
    const entityId = getNodeEntityId(node);
    if (entityId) {
      const tail = tails.get(entityId);
      if (tail) {
        tail.children.push(node);
        tails.set(entityId, node);
        continue;
      }
      tails.set(entityId, node);
    }
    roots.push(node);
  }

  return roots;
}

/** Разбивает корневые узлы фазы окружения на подфазы по одному актёру.
 *
 *  Входные узлы уже прошли через chainNodesByEntity, поэтому у каждой сущности
 *  не более одного корневого узла (с цепочкой children). Группировка здесь
 *  — страховка: явно собирает узлы одного entityId в одну подфазу и повторно
 *  выстраивает их в цепочку parent → child, чтобы анимации актёра шли строго
 *  последовательно. */
function splitByActor(nodes: AnimationNode[]): AnimationNode[][] {
  const groups: AnimationNode[][] = [];
  const entityToGroup = new Map<string, number>();

  for (const node of nodes) {
    const entityId = getNodeEntityId(node);
    if (entityId) {
      const index = entityToGroup.get(entityId);
      if (index !== undefined) {
        groups[index]!.push(node);
      } else {
        entityToGroup.set(entityId, groups.length);
        groups.push([node]);
      }
    } else {
      // Ноды без привязки к сущности (например, FOG_UPDATE) идут отдельно.
      groups.push([node]);
    }
  }

  return groups.map((group) => chainNodesByEntity(group));
}

/** Рекурсивно конвертирует ExecutionNode в AnimationNode[].
 *  Если текущее событие не маппится в шаг — узел "растворяется",
 *  а его дети поднимаются как сиблинги к ближайшему анимированному предку. */
function convertExecutionNode(node: ExecutionNode, state: GameState): AnimationNode[] {
  const builder = builders.get(node.event.type);

  const childNodes: AnimationNode[] = [];
  for (const child of node.children) {
    childNodes.push(...convertExecutionNode(child, state));
  }

  if (builder) {
    const nodes = builder(node.event, childNodes, state);
    if (nodes) return nodes;
  }

  return childNodes;
}
