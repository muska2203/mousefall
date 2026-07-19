/**
 * Анимационный композер для способности "Рассечение".
 *
 * Строит дерево: каст способности → дуга удара по цели и боковым клеткам.
 * Боковые клетки — это соседи целевой клетки, которые одновременно являются
 * соседями кастующего (пересечение 8-соседей цели и кастера).
 */

import type {Position} from '@presentation/types';
import {abilityCastNode, slashArcNode} from '../core/primitives';
import type {SkillComposer} from './registry';
import {registerSkillComposer} from './registry';

/** Найти боковые клетки для Рассечения.
 *
 * Для направления удара (dx, dy) от кастера к цели перебираем всех 8 соседей
 * кастующего (ox, oy) и оставляем тех, кто одновременно является соседом
 * целевой клетки: max(|ox - dx|, |oy - dy|) <= 1. Сама цель исключается. */
function findSideCells(from: Position, target: Position): Position[] {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const sides: Position[] = [];

  for (let ox = -1; ox <= 1; ox += 1) {
    for (let oy = -1; oy <= 1; oy += 1) {
      if (ox === 0 && oy === 0) continue;
      if (ox === dx && oy === dy) continue;
      if (Math.abs(ox - dx) + Math.abs(oy - dy) <= 1) {
        sides.push({ x: from.x + ox, y: from.y + oy });
      }
    }
  }

  return sides;
}

/** Угол от клетки from к клетке pos в радианах. */
function angleTo(from: Position, pos: Position): number {
  return Math.atan2(pos.y - from.y, pos.x - from.x);
}

export const cleaveComposer: SkillComposer = (event, children, _state) => {
  const target = event.targets[0];
  if (!target) {
    return [abilityCastNode(event, children)];
  }

  const sideCells = findSideCells(event.from, target);
  // Сортируем боковые клетки против часовой стрелки относительно кастующего,
  // чтобы дуга визуально «разворачивалась» от одного края к другому через центр.
  sideCells.sort((a, b) => angleTo(event.from, a) - angleTo(event.from, b));

  const positions: Position[] =
    sideCells.length >= 2
      ? [sideCells[0]!, target, sideCells[1]!]
      : [target, ...sideCells];

  return [
    abilityCastNode(event, [
      slashArcNode(event.from, positions, children),
    ]),
  ];
};

registerSkillComposer('cleave', cleaveComposer);
