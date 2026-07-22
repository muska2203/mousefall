/**
 * Планировщик PresentationNode.
 *
 * Обходит дерево ExecutionNode из SimulationResult и для каждого события создаёт
 * DisplayPatch, флаг полевой анимации и корневые AnimationNode с учётом детей.
 * FOV-фильтрация применяется к полевым анимациям: невидимый узел "растворяется",
 * его патч переносится на ближайшего видимого предка (или видимых потомков).
 */

import type {ExecutionNode, GameEvent, GameState, SimulationResult, TurnSide} from '@simulation/types';
import type {AnimationNode, AnimationPhase} from '@presentation/types';
// Регистрация стандартных builders выполняется через side-effect.
import '../animation/register';
import type {DisplayPatch, PresentationNode} from './types';
import {createPatch} from './builder';
import {getAnimationBuilder} from '../animation/core/registry';
import {isEventVisible} from '../fogFilter';
import {buildAnimationTree as buildAnimationPhases} from '../animation/core/treeBuilder';

/** Типы событий, которые происходят на поле и подлежат FOV-фильтрации. */
const FIELD_EVENT_TYPES = new Set<GameEvent['type']>([
  'ENTITY_MOVED',
  'ENTITY_DAMAGED',
  'ENTITY_DIED',
  'ENTITY_HEALED',
  'ENTITY_MISSED',
  'ENTITY_BUMPED',
  'ENTITY_COLLIDED',
  'ENTITY_DISPLACED',
  'STATUS_APPLIED',
  'STATUS_REMOVED',
  'STATUS_BLOCKED',
  'STATUS_TICKED',
  'FOG_UPDATED',
  'DOOR_OPENED',
  'DOOR_CLOSED',
  'ITEM_DROPPED',
  'ITEM_PICKED_UP',
  'DEAD_ENTITIES_CLEANED',
  'ABILITY_USED',
  'COUNTER_ATTACK_APPLIED',
  'FLOOR_CHANGED',
  'TILE_EFFECT_CHANGED',
  'TILE_EFFECT_REMOVED',
  'TILE_EFFECT_STATUS_APPLIED',
  'TILE_EFFECT_STATUS_REMOVED',
]);

/** Определить, является ли событие полевым. */
function isFieldEvent(event: GameEvent): boolean {
  return FIELD_EVENT_TYPES.has(event.type);
}

/** Прикрепить собственный патч к каждому корневому AnimationNode.
 *
 *  Если корень уже несёт другой патч, старый патч сдвигается в массив patches. */
function applyOwnPatch(roots: AnimationNode[], patch: DisplayPatch): void {
  for (const root of roots) {
    if (root.patch === undefined) {
      root.patch = patch;
    } else {
      if (!root.patches) root.patches = [];
      root.patches.push(root.patch);
      root.patch = patch;
    }
  }
}

/** Прикрепить "утекший" патч от невидимого дочернего события к первому корню.
 *
 *  Собственный патч корня сохраняется, утечка идёт в массив patches. */
function applyPropagatedPatch(roots: AnimationNode[], patch: DisplayPatch): void {
  if (roots.length === 0) return;
  const root = roots[0]!;
  if (root.patch === undefined) {
    root.patch = patch;
  } else {
    if (!root.patches) root.patches = [];
    root.patches.push(patch);
  }
}

/** Рекурсивно обойти ExecutionNode и собрать PresentationNode.
 *
 *  Возвращает корневой PresentationNode для текущего узла. */
function visitExecutionNode(
  node: ExecutionNode,
  parent: PresentationNode | null,
  side: TurnSide,
  state: GameState,
  out: PresentationNode[],
): PresentationNode {
  const patch = createPatch(node.event, state);
  const isField = isFieldEvent(node.event);
  const visible = !isField || isEventVisible(node.event, state);

  const presentationNode: PresentationNode = {
    event: node.event,
    patch,
    animations: null,
    isFieldAnimation: isField,
    parent,
    children: [],
    side,
  };

  if (parent) {
    parent.children.push(presentationNode);
  }

  out.push(presentationNode);

  // Сначала строим детей, чтобы получить их анимации и "утекшие" патчи.
  const childRoots: AnimationNode[] = [];
  const propagatedPatches: DisplayPatch[] = [];

  for (const child of node.children) {
    const childNode = visitExecutionNode(child, presentationNode, side, state, out);
    if (childNode.animations && childNode.animations.length > 0) {
      childRoots.push(...childNode.animations);
    } else {
      propagatedPatches.push(childNode.patch);
    }
  }

  const builder = getAnimationBuilder(node.event.type);
  let ownRoots: AnimationNode[] | null = null;

  if (visible) {
    if (builder) {
      ownRoots = builder(node.event, childRoots, state);
    }
    // Если builder не вернул корневые узлы, событие "растворяется":
    // дети поднимаются на текущий уровень.
    if (!ownRoots || ownRoots.length === 0) {
      ownRoots = childRoots.length > 0 ? childRoots : null;
    }
  } else {
    // Невидимый полевой узел "растворяется": его видимые потомки становятся
    // его анимациями, чтобы не потерять их, а собственный патч переносится на них.
    ownRoots = childRoots.length > 0 ? childRoots : null;
  }

  if (ownRoots) {
    // Патчи от невидимых детей, у которых не осталось видимых потомков,
    // прикрепляем к ближайшему видимому предку (текущему узлу).
    for (const propagated of propagatedPatches) {
      applyPropagatedPatch(ownRoots, propagated);
    }

    // Собственный патч текущего узла прикрепляем ко всем корневым узлам.
    applyOwnPatch(ownRoots, patch);
  }

  presentationNode.animations = ownRoots;
  return presentationNode;
}

/** Построить плоский план PresentationNode из SimulationResult. */
export function buildPresentationPlan(
  result: SimulationResult,
  state: GameState,
): PresentationNode[] {
  const plan: PresentationNode[] = [];

  for (const phase of result.phases) {
    for (const action of phase.actions) {
      visitExecutionNode(action, null, phase.side, state, plan);
    }
  }

  return plan;
}

/** Построить AnimationPhase[] из SimulationResult.
 *
 *  Сначала создаёт план PresentationNode, затем группирует корневые узлы в фазы. */
export function buildAnimationTree(
  result: SimulationResult,
  state: GameState,
): AnimationPhase[] {
  const plan = buildPresentationPlan(result, state);
  return buildAnimationPhases(plan, state);
}
