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
 * Возвращает клетки для выбора направления рывка.
 * Для каждого из 8 направлений добавляет клетки на расстоянии 1 и 2,
 * чтобы UI позволял выбрать любую доступную клетку в радиусе 2 клеток.
 */
function getDashTargetPositions(state: GameState, caster: Entity): Position[] {
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];

  const positions: Position[] = [];
  for (const dir of directions) {
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
 * Находит живого актора на заданной клетке или undefined.
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
 * Возвращает уровень скилла у кастера.
 */
function getSkillLevel(caster: Entity): number {
  if (caster.type !== 'player') return 1;
  return caster.abilities.find(a => a.templateId === 'dash')?.level ?? 1;
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
    return this.resolve(state, caster, [hoveredTarget]);
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

    const intents: Intent[] = [];
    const skillLevel = getSkillLevel(caster);

    for (let step = 1; step <= DASH_DISTANCE; step++) {
      const cellX = caster.x + stepX * step;
      const cellY = caster.y + stepY * step;

      // Стена или за пределами карты — остановка перед клеткой с отскоком.
      if (
        cellX < 0 ||
        cellX >= state.map.width ||
        cellY < 0 ||
        cellY >= state.map.height ||
        state.map.tiles[cellY]?.[cellX] === 'wall'
      ) {
        intents.push({
          type: 'BUMP',
          entityId: caster.id,
          position: { x: caster.x + stepX * (step - 1), y: caster.y + stepY * (step - 1) },
          dx: stepX,
          dy: stepY,
        });
        break;
      }

      // Закрытая дверь на пути рывка открывается и не блокирует движение.
      const door = findDoorAt(state, cellX, cellY);
      if (door && !door.isOpen) {
        intents.push({ type: 'OPEN_DOOR', entityId: caster.id, targetPosition: { x: cellX, y: cellY } });
        intents.push({ type: 'MOVE', entityId: caster.id, dx: stepX, dy: stepY });
        continue;
      }

      // Актор на пути — урон, отталкивание и, возможно, движение кастера.
      const actor = findActorAt(state, cellX, cellY);
      if (actor && isCombatEntity(caster) && isDamageable(actor)) {
        const pushTargetX = cellX + stepX;
        const pushTargetY = cellY + stepY;

        // Начальный урон при столкновении рывка.
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

        // Отталкивание всегда генерируется — его executor разберётся с последствиями.
        intents.push({ type: 'PUSH', entityId: actor.id, dx: stepX, dy: stepY, sourceEntityId: caster.id });

        // Кастер двигается в клетку актора только если пуш, скорее всего, успешен.
        // Решение принимаем на основе текущего состояния.
        const pushBlocked =
          pushTargetX < 0 ||
          pushTargetX >= state.map.width ||
          pushTargetY < 0 ||
          pushTargetY >= state.map.height ||
          state.map.tiles[pushTargetY]?.[pushTargetX] === 'wall' ||
          isBlocked(state, pushTargetX, pushTargetY);

        if (!pushBlocked) {
          intents.push({ type: 'MOVE', entityId: caster.id, dx: stepX, dy: stepY });
        } else {
          // Пуш заблокирован — кастер остаётся на предыдущей клетке и отскакивает.
          intents.push({
            type: 'BUMP',
            entityId: caster.id,
            position: { x: caster.x + stepX * (step - 1), y: caster.y + stepY * (step - 1) },
            dx: stepX,
            dy: stepY,
          });
          break;
        }
        continue;
      }

      // Любой другой непроходимый объект — остановка с отскоком.
      if (isBlocked(state, cellX, cellY)) {
        intents.push({
          type: 'BUMP',
          entityId: caster.id,
          position: { x: caster.x + stepX * (step - 1), y: caster.y + stepY * (step - 1) },
          dx: stepX,
          dy: stepY,
        });
        break;
      }

      // Пустая клетка — движение.
      intents.push({ type: 'MOVE', entityId: caster.id, dx: stepX, dy: stepY });
    }

    return intents;
  },
};
