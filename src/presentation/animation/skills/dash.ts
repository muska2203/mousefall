/**
 * Анимационный композер для способности Dash.
 */

import type { GameState } from '@simulation/types';
import type { AnimationNode, Position } from '@presentation/types';
import type { AbilityEvent } from '../core/primitives';
import type { SkillComposer } from './registry';
import { registerSkillComposer } from './registry';
import { positionsEqual } from '../core/treeBuilder';

/** Длительность одной клетки рывка — быстрее обычного передвижения. */
const DASH_MOVE_DURATION_MS = 110;

/** Добавить значение в массив Map, создавая массив при необходимости. */
function pushToMap<T>(map: Map<string, T[]>, key: string, value: T): void {
  const arr = map.get(key);
  if (arr) {
    arr.push(value);
  } else {
    map.set(key, [value]);
  }
}

/** Строит специализированное дерево анимаций для рывка.
 *
 * - Пропускает анимацию каста.
 * - Устанавливает ускоренную длительность движения кастера.
 * - Прикрепляет отскок к последнему шагу кастера.
 * - Переносит урон/отталкивание/статус врага к моменту приближения кастера. */
function buildDashAnimationNodes(casterId: string, childNodes: AnimationNode[]): AnimationNode[] {
  const casterMoves: AnimationNode[] = [];
  const casterBounces: AnimationNode[] = [];
  const otherRoots: AnimationNode[] = [];
  const enemyNodes = new Map<string, AnimationNode[]>();

  for (const node of childNodes) {
    const step = node.step;
    if (step.type === 'MOVE' && step.entityId === casterId) {
      step.duration = DASH_MOVE_DURATION_MS;
      step.sway = false;
      casterMoves.push(node);
    } else if (step.type === 'BOUNCE' && step.entityId === casterId) {
      casterBounces.push(node);
    } else if (step.type === 'MOVE') {
      pushToMap(enemyNodes, step.entityId, node);
    } else if (step.type === 'DAMAGE') {
      pushToMap(enemyNodes, step.targetId, node);
    } else if (step.type === 'HP_CHANGE') {
      pushToMap(enemyNodes, step.entityId, node);
    } else if (step.type === 'STATUS_BURST') {
      pushToMap(enemyNodes, step.entityId, node);
    } else {
      otherRoots.push(node);
    }
  }

  if (casterMoves.length === 0) {
    // Рывок без движения — оставляем узлы как есть (например, отскок о стену на месте).
    return childNodes;
  }

  const findCollisionMove = (collisionPos: Position): AnimationNode => {
    const move = casterMoves.find((m) => m.step.type === 'MOVE' && positionsEqual(m.step.to, collisionPos));
    return move ?? casterMoves[casterMoves.length - 1]!;
  };

  for (const nodes of enemyNodes.values()) {
    const enemyMove = nodes.find((n) => n.step.type === 'MOVE');
    const damageNode = nodes.find((n) => n.step.type === 'DAMAGE');
    const hpChangeNode = nodes.find((n) => n.step.type === 'HP_CHANGE');
    const collisionPos = enemyMove?.step.type === 'MOVE'
      ? enemyMove.step.from
      : damageNode?.step.type === 'DAMAGE'
        ? damageNode.step.position
        : hpChangeNode?.step.type === 'HP_CHANGE'
          ? hpChangeNode.step.position
          : undefined;
    const collisionMove = collisionPos !== undefined ? findCollisionMove(collisionPos) : casterMoves[casterMoves.length - 1]!;
    for (const n of nodes) {
      collisionMove.children.push(n);
    }
  }

  const lastCasterMove = casterMoves[casterMoves.length - 1]!;
  for (const bounce of casterBounces) {
    lastCasterMove.children.push(bounce);
  }

  return [...casterMoves, ...otherRoots];
}

export const dashComposer: SkillComposer = (event, children) => {
  return buildDashAnimationNodes(event.entityId, children);
};

registerSkillComposer('dash', dashComposer);
