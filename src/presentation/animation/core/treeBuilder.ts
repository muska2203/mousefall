/**
 * Построитель дерева анимаций из плоского списка PresentationNode.
 *
 * Ответственность:
 * - Группировка корневых PresentationNode по фазам (стороне хода).
 * - Сохранение логики chainNodesByEntity и splitByActor.
 *
 * Правила:
 * - FOV-фильтрация выполняется на этапе построения PresentationNode (planner).
 * - Этот модуль работает только с уже отфильтрованными узлами.
 */

import type {GameState, TurnSide} from '@simulation/types';
import type {AnimationNode, AnimationPhase, Position} from '@presentation/types';
import type {PresentationNode} from '@presentation/displayState/types';

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

/** Построить дерево анимаций из плоского списка PresentationNode.
 *
 *  Использует только корневые узлы (parent === null) и группирует их по side.
 *  Внутри каждой фазы применяется chainNodesByEntity и splitByActor. */
export function buildAnimationTree(nodes: PresentationNode[], _state: GameState): AnimationPhase[] {
  const phases: AnimationPhase[] = [];
  const phaseOrder: TurnSide[] = [];
  const phaseRoots = new Map<TurnSide, AnimationNode[]>();

  for (const node of nodes) {
    if (node.parent !== null) continue;
    if (!node.animations || node.animations.length === 0) continue;

    if (!phaseOrder.includes(node.side)) {
      phaseOrder.push(node.side);
    }

    const roots = phaseRoots.get(node.side) ?? [];
    roots.push(...node.animations);
    phaseRoots.set(node.side, roots);
  }

  for (const side of phaseOrder) {
    const roots = phaseRoots.get(side) ?? [];
    if (roots.length === 0) continue;

    const chainedNodes = chainNodesByEntity(roots);
    if (chainedNodes.length === 0) continue;

    // Ходы не-игроковских фракций разбиваем на подфазы по актёрам, чтобы
    // акторы ходили последовательно друг за другом, а не параллельно.
    // Служебные фазы ('status_tick', 'round_recovery', 'environment') идут как обычные фазы.
    if (side !== 'player' && side !== 'status_tick' && side !== 'round_recovery' && side !== 'environment') {
      const subPhases = splitByActor(chainedNodes);
      for (const sub of subPhases) {
        phases.push({ side, nodes: sub, sequential: true });
      }
    } else {
      phases.push({ side, nodes: chainedNodes });
    }
  }

  return phases;
}
