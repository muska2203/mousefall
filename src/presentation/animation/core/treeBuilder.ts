/**
 * Построитель дерева анимаций из дерева ExecutionNode.
 *
 * Ответственность:
 * - Обход дерева событий SimulationResult.
 * - Преобразование GameEvent → AnimationNode (дерево).
 * - Цепочка узлов одной сущности и разбиение фазы окружения по актёрам.
 *
 * Правила:
 * - Не содержит игровой логики.
 * - Только перевод событий в декларативные анимации.
 * - Неанимированные события пропускаются; их дети поднимаются как сиблинги к ближайшему анимированному предку.
 */

import type { SimulationResult, GameState, TurnSide, ExecutionNode } from '@simulation/types';
import type { AnimationNode, AnimationPhase, Position } from '@presentation/types';
import { filterByFOV } from '@presentation/fogFilter';
import { getAnimationBuilder } from './registry';

/** Возвращает ID сущности, которой принадлежит анимационный узел, или null. */
function getNodeEntityId(node: AnimationNode): string | null {
  const step = node.step;
  switch (step.type) {
    case 'MOVE':
    case 'JUMP':
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

/** Добавить значение в массив Map, создавая массив при необходимости. */
function pushToMap<T>(map: Map<string, T[]>, key: string, value: T): void {
  const arr = map.get(key);
  if (arr) {
    arr.push(value);
  } else {
    map.set(key, [value]);
  }
}

/** Сравнить две позиции по координатам. */
export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Превращает последовательные узлы одной сущности в цепочку parent → child.
 *  Нужно, чтобы sequencer не запускал их параллельно и не отменял предыдущую анимацию
 *  одного и того же спрайта (например, два MOVE врага за ход или рывок игрока).
 *  Работает рекурсивно на всех уровнях дерева. */
export function chainNodesByEntity(nodes: AnimationNode[]): AnimationNode[] {
  const roots: AnimationNode[] = [];
  const tails = new Map<string, AnimationNode>();

  for (const node of nodes) {
    // Сначала обрабатываем детей рекурсивно.
    if (node.children.length > 0) {
      node.children = chainNodesByEntity(node.children);
    }

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
  const builder = getAnimationBuilder(node.event.type);

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

/** Построить дерево анимаций из SimulationResult. */
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

    // Ходы не-игроковских фракций разбиваем на подфазы по актёрам, чтобы
    // акторы ходили последовательно друг за другом, а не параллельно.
    // Служебные фазы ('status_tick', 'round_recovery', 'environment') идут как обычные фазы.
    if (phase.side !== 'player' && phase.side !== 'status_tick' && phase.side !== 'round_recovery' && phase.side !== 'environment') {
      const subPhases = splitByActor(chainedNodes);
      for (const nodes of subPhases) {
        phases.push({ side: phase.side, nodes, sequential: true });
      }
    } else {
      phases.push({ side: phase.side, nodes: chainedNodes });
    }
  }

  return phases;
}
