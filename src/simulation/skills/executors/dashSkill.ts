import { GameState, Position, Entity } from '@simulation/types';
import { Intent } from '@simulation/systems/intents/types';
import { TargetMode } from '@simulation/core-types';
import { SkillExecutor } from '@simulation/skills/skillExecutor';
import { damageFormulas } from '@simulation/skills/damageFormula';
import { isCombatEntity, isDamageable, isActor, findDoorAt, isBlocked } from '@simulation/state';

/**
 * Базовый урон при столкновении рывка с актором.
 */
const DASH_BUMP_BASE_DAMAGE = 5;

/**
 * Расстояние рывка в клетках.
 */
const DASH_DISTANCE = 2;

/**
 * Все восемь направлений движения по сетке.
 */
const DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: -1 },
];

/**
 * Проверяет, можно ли начать рывок в заданном направлении.
 * Первая клетка пути не должна быть стеной или непроходимым объектом.
 * Закрытая дверь является исключением — рывок открывает её и проходит дальше.
 */
function isDashStartAllowed(state: GameState, caster: Entity, dx: number, dy: number): boolean {
  const x = caster.x + dx;
  const y = caster.y + dy;

  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) return false;
  if (state.map.tiles[y]?.[x] === 'wall') return false;

  const door = findDoorAt(state, x, y);
  if (door && !door.isOpen) return true;

  return !isBlocked(state, x, y);
}

/**
 * Возвращает клетки для выбора направления рывка.
 * Направление включаётся в список целей только если первая клетка пути свободна
 * (либо это закрытая дверь). Для каждого допустимого направления добавляются
 * клетки на расстоянии 1 и 2.
 */
function getDashTargetPositions(state: GameState, caster: Entity): Position[] {
  const positions: Position[] = [];
  for (const dir of DIRECTIONS) {
    if (!isDashStartAllowed(state, caster, dir.dx, dir.dy)) continue;

    for (let step = 1; step <= DASH_DISTANCE; step++) {
      const x = caster.x + dir.dx * step;
      const y = caster.y + dir.dy * step;
      if (x >= 0 && x < state.map.width && y >= 0 && y < state.map.height) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

/**
 * Находит живого, уязвимого актора на заданной клетке или undefined.
 */
function findActorAt(state: GameState, x: number, y: number): Entity | undefined {
  for (const entity of state.entities.values()) {
    if (entity.x === x && entity.y === y && isActor(entity) && isDamageable(entity)) {
      return entity;
    }
  }
  return undefined;
}

/**
 * Возвращает уровень скилла рывка у кастера.
 */
function getSkillLevel(caster: Entity): number {
  if (caster.type !== 'player') return 1;
  return caster.abilities.find(a => a.templateId === 'dash')?.level ?? 1;
}

/**
 * Предсказывает результат рывка без мутации состояния.
 * Актор останавливается на клетке перед любым объектом (стеной, актором и т.п.),
 * независимо от того, удастся ли оттолкнуть цель. Проверка успешности пуша
 * не выполняется, что упрощает превью.
 */
function predictDashIntents(state: GameState, caster: Entity, target: Position): Intent[] {
  const dx = target.x - caster.x;
  const dy = target.y - caster.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);

  if (stepX === 0 && stepY === 0) {
    return [];
  }

  if (!isDashStartAllowed(state, caster, stepX, stepY)) {
    return [];
  }

  const intents: Intent[] = [];
  let currentX = caster.x;
  let currentY = caster.y;
  let totalDx = 0;
  let totalDy = 0;
  const skillLevel = getSkillLevel(caster);

  for (let step = 1; step <= DASH_DISTANCE; step++) {
    const cellX = currentX + stepX;
    const cellY = currentY + stepY;

    // Стена или граница карты — рывок заканчивается на предыдущей клетке.
    if (
      cellX < 0 ||
      cellX >= state.map.width ||
      cellY < 0 ||
      cellY >= state.map.height ||
      state.map.tiles[cellY]?.[cellX] === 'wall'
    ) {
      break;
    }

    // Закрытая дверь открывается и не блокирует движение.
    const door = findDoorAt(state, cellX, cellY);
    if (door && !door.isOpen) {
      totalDx += stepX;
      totalDy += stepY;
      currentX += stepX;
      currentY += stepY;
      continue;
    }

    // Актор на пути — урон и отталкивание. Кастер остаётся на клетке перед ним.
    const actor = findActorAt(state, cellX, cellY);
    if (actor && isCombatEntity(caster) && isDamageable(actor)) {
      const dashFormula = damageFormulas['dash_bump'];
      if (dashFormula) {
        const damageEntries = dashFormula({
          caster,
          target: actor,
          skillLevel,
          baseDamage: DASH_BUMP_BASE_DAMAGE,
        });
        for (const entry of damageEntries) {
          intents.push({
            type: 'DAMAGE',
            entityId: actor.id,
            sourceEntityId: caster.id,
            damage: entry.damage,
            damageType: entry.damageType,
          });
        }
      }

      intents.push({ type: 'PUSH', entityId: actor.id, dx: stepX, dy: stepY, sourceEntityId: caster.id });
      break;
    }

    // Любой другой непроходимый объект — рывок заканчивается на предыдущей клетке.
    if (isBlocked(state, cellX, cellY)) {
      break;
    }

    // Пустая клетка — движение.
    totalDx += stepX;
    totalDy += stepY;
    currentX += stepX;
    currentY += stepY;
  }

  if (totalDx !== 0 || totalDy !== 0) {
    intents.unshift({ type: 'MOVE', entityId: caster.id, dx: totalDx, dy: totalDy });
  }

  return intents;
}

export const dashSkill: SkillExecutor = {
  id: 'dash',

  getTargetMode(): TargetMode {
    return { type: 'single', range: 2 };
  },

  getValidTargets(state: GameState, caster: Entity): Position[] {
    return getDashTargetPositions(state, caster);
  },

  preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
    if (!hoveredTarget) return [];
    return predictDashIntents(state, caster, hoveredTarget);
  },

  getAffectedPositions(_state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
    if (!hoveredTarget) return [];
    const dx = hoveredTarget.x - caster.x;
    const dy = hoveredTarget.y - caster.y;
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const positions: Position[] = [];
    for (let step = 1; step <= DASH_DISTANCE; step++) {
      positions.push({ x: caster.x + stepX * step, y: caster.y + stepY * step });
    }
    return positions;
  },

  resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
    const target = targets[0];
    if (!target) return [];

    const dx = target.x - caster.x;
    const dy = target.y - caster.y;

    // Рывок — только в одном из 8 направлений.
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    if (stepX === 0 && stepY === 0) {
      return [];
    }

    // Валидация направления происходит через getValidTargets, но оставляем
    // защиту и здесь, чтобы intent не создавался для заведомо недопустимого пути.
    if (!isDashStartAllowed(state, caster, stepX, stepY)) {
      return [];
    }

    // Один intent: executor сам разберётся со столкновениями и дистанцией.
    return [
      {
        type: 'DASH',
        entityId: caster.id,
        dx: stepX,
        dy: stepY,
        distance: DASH_DISTANCE,
      },
    ];
  },
};
