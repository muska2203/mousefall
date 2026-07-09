import { GameState, Position, Entity } from '@simulation/types';
import { Intent } from '@simulation/systems/intents/types';
import { TargetMode } from '@simulation/core-types';
import { SkillExecutor } from '@simulation/skills/skillExecutor';
import { damageFormulas } from '@simulation/skills/damageFormula';
import { isCombatEntity, isDamageable, isActor, findDoorAt, isBlocked } from '@simulation/state';
import { getAbilityTags, getSkillDamageTag } from '@simulation/systems/tags/ability-tags';
import { mergeDamageIntentTags } from '@simulation/systems/tags/tag-helpers';
import { tryGetAbility } from '@content/registry';

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
 * Направление включается в список целей только если первая клетка пути свободна
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
 * Приводит выбранную цель к клетке на максимальном расстоянии рывка.
 * Клетка на расстоянии 1 воспринимается как указание направления,
 * поэтому скилл всегда стремится пройти полное расстояние.
 */
function normalizeDashTarget(caster: Entity, target: Position): Position {
  const dx = target.x - caster.x;
  const dy = target.y - caster.y;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));

  if (distance === 0 || distance >= DASH_DISTANCE) {
    return target;
  }

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  return {
    x: caster.x + stepX * DASH_DISTANCE,
    y: caster.y + stepY * DASH_DISTANCE,
  };
}

/**
 * Разрешает рывок в список атомарных интентов.
 *
 * Каждый интент в итоговом списке проходит через executeIntent,
 * поэтому мировые реакции срабатывают корректно (смерть от урона,
 * отталкивание, оглушение, лестницы и т.д.).
 *
 * Выбранная цель воспринимается как направление: если игрок указал
 * клетку на расстоянии 1, она нормализуется до клетки на расстоянии 2
 * в том же направлении. Движение разбивается на пошаговые MOVE-интенты,
 * чтобы закрытая дверь открывалась перед попыткой встать на её клетку.
 *
 * Порядок интентов:
 * 1. OPEN_DOOR — если на пути закрытая дверь (перед движением через неё).
 * 2. MOVE — перемещение кастера на одну клетку.
 * 3. DAMAGE — урон акторам на пути.
 * 4. PUSH — отталкивание актора.
 * 5. BUMP — визуальный отскок кастера при столкновении.
 */
function resolveDashIntents(state: GameState, caster: Entity, target: Position, skillId: string): Intent[] {
  const normalizedTarget = normalizeDashTarget(caster, target);
  const dx = normalizedTarget.x - caster.x;
  const dy = normalizedTarget.y - caster.y;
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
  const maxSteps = Math.max(Math.abs(dx), Math.abs(dy));
  const skillLevel = getSkillLevel(caster);
  const ability = tryGetAbility(skillId);
  const damageTag = getSkillDamageTag(ability);
  const abilityTags = getAbilityTags(skillId);

  for (let step = 1; step <= maxSteps; step++) {
    const cellX = currentX + stepX;
    const cellY = currentY + stepY;

    // Стена или граница карты — кастер остаётся на предыдущей клетке и отскакивает.
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
        position: { x: currentX, y: currentY },
        dx: stepX,
        dy: stepY,
      });
      break;
    }

    // Закрытая дверь открывается, и кастер проходит через неё.
    const door = findDoorAt(state, cellX, cellY);
    if (door && !door.isOpen) {
      intents.push({
        type: 'OPEN_DOOR',
        entityId: caster.id,
        targetPosition: { x: cellX, y: cellY },
      });
      intents.push({ type: 'MOVE', entityId: caster.id, dx: stepX, dy: stepY });
      currentX += stepX;
      currentY += stepY;
      continue;
    }

    // Актор на пути — урон, отталкивание, кастер остаётся на клетке перед ним и отскакивает.
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
          const tags = mergeDamageIntentTags(entry.tags, abilityTags);
          intents.push({
            type: 'DAMAGE',
            entityId: actor.id,
            sourceEntityId: caster.id,
            damage: entry.damage,
            tags: damageTag ? mergeDamageIntentTags([damageTag], tags) : tags,
          });
        }
      }

      intents.push({ type: 'PUSH', entityId: actor.id, dx: stepX, dy: stepY, sourceEntityId: caster.id });
      intents.push({
        type: 'BUMP',
        entityId: caster.id,
        position: { x: currentX, y: currentY },
        dx: stepX,
        dy: stepY,
      });
      break;
    }

    // Любой другой непроходимый объект — кастер остаётся на предыдущей клетке и отскакивает.
    if (isBlocked(state, cellX, cellY)) {
      intents.push({
        type: 'BUMP',
        entityId: caster.id,
        position: { x: currentX, y: currentY },
        dx: stepX,
        dy: stepY,
      });
      break;
    }

    // Пустая клетка — движение.
    intents.push({ type: 'MOVE', entityId: caster.id, dx: stepX, dy: stepY });
    currentX += stepX;
    currentY += stepY;
  }

  return intents;
}

/**
 * Превью рывка: тот же набор интентов, что и при исполнении,
 * но без визуальных BUMP-эффектов (они не нужны для предпросмотра).
 */
function predictDashIntents(state: GameState, caster: Entity, target: Position, skillId: string): Intent[] {
  return resolveDashIntents(state, caster, target, skillId).filter(intent => intent.type !== 'BUMP');
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
    return predictDashIntents(state, caster, hoveredTarget, this.id);
  },

  getAffectedPositions(_state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
    if (!hoveredTarget) return [];
    const normalizedTarget = normalizeDashTarget(caster, hoveredTarget);
    const dx = normalizedTarget.x - caster.x;
    const dy = normalizedTarget.y - caster.y;
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const maxSteps = Math.max(Math.abs(dx), Math.abs(dy));
    const positions: Position[] = [];
    for (let step = 1; step <= maxSteps; step++) {
      positions.push({ x: caster.x + stepX * step, y: caster.y + stepY * step });
    }
    return positions;
  },

  resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
    const target = targets[0];
    if (!target) return [];
    return resolveDashIntents(state, caster, target, this.id);
  },
};
