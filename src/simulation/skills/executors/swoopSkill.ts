import { GameState, Position, Entity } from '@simulation/types';
import { Intent } from '@simulation/systems/intents/types';
import { TargetMode } from '@simulation/core-types';
import { SkillExecutor } from '@simulation/skills/skillExecutor';
import { damageFormulas } from '@simulation/skills/damageFormula';
import { getEntitiesInRadius } from '@simulation/skills/targeting';
import { isCombatEntity, isDamageable, isBlocked } from '@simulation/state';

/**
 * Радиус выбора точки приземления относительно кастера.
 */
const SWOOP_JUMP_RADIUS = 2;

/**
 * Радиус удара по земле вокруг точки приземления.
 */
export const SWOOP_AOE_RADIUS = 1;

/**
 * Базовый урон от удара по земле.
 */
const SWOOP_BASE_DAMAGE = 8;

/**
 * Возвращает клетки, в которые кастер может приземлиться:
 * не стены, не занятые непроходимыми объектами, в пределах радиуса 2.
 */
function getJumpTargets(state: GameState, caster: Entity): Position[] {
  const positions: Position[] = [];

  for (let dy = -SWOOP_JUMP_RADIUS; dy <= SWOOP_JUMP_RADIUS; dy++) {
    for (let dx = -SWOOP_JUMP_RADIUS; dx <= SWOOP_JUMP_RADIUS; dx++) {
      if (dx === 0 && dy === 0) continue;

      const x = caster.x + dx;
      const y = caster.y + dy;

      if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) continue;
      if (state.map.tiles[y]?.[x] === 'wall') continue;
      if (isBlocked(state, x, y)) continue;

      positions.push({ x, y });
    }
  }

  return positions;
}

/**
 * Возвращает уровень скилла у кастера.
 */
function getSkillLevel(caster: Entity): number {
  if (caster.type !== 'player') return 1;
  return caster.abilities.find(a => a.templateId === 'swoop')?.level ?? 1;
}

/**
 * Проверяет, что выбранная точка является допустимой для приземления.
 */
function isValidJumpTarget(state: GameState, caster: Entity, target: Position): boolean {
  if (
    target.x < 0 ||
    target.x >= state.map.width ||
    target.y < 0 ||
    target.y >= state.map.height
  ) {
    return false;
  }

  if (state.map.tiles[target.y]?.[target.x] === 'wall') return false;
  if (isBlocked(state, target.x, target.y)) return false;

  const dx = target.x - caster.x;
  const dy = target.y - caster.y;
  if (dx === 0 && dy === 0) return false;
  if (Math.abs(dx) > SWOOP_JUMP_RADIUS || Math.abs(dy) > SWOOP_JUMP_RADIUS) return false;

  return true;
}

/**
 * Разрешает способность в набор интентов.
 */
function resolveSwoopIntents(state: GameState, caster: Entity, targets: Position[]): Intent[] {
  if (!isCombatEntity(caster)) return [];

  const target = targets[0];
  if (!target) return [];
  if (!isValidJumpTarget(state, caster, target)) return [];

  const intents: Intent[] = [];
  const skillLevel = getSkillLevel(caster);

  // Прыжок в выбранную точку.
  intents.push({
    type: 'JUMP',
    entityId: caster.id,
    dx: target.x - caster.x,
    dy: target.y - caster.y,
  });

  // Удар по земле: урон и отталкивание всем живым объектам с hp в радиусе.
  const affectedEntities = getEntitiesInRadius(state, target, SWOOP_AOE_RADIUS);
  const formula = damageFormulas['swoop_slam'];

  for (const entity of affectedEntities) {
    if (entity.id === caster.id) continue;
    if (!isDamageable(entity)) continue;

    if (formula) {
      const damageEntries = formula({
        caster,
        target: entity,
        skillLevel,
        baseDamage: SWOOP_BASE_DAMAGE,
      });

      for (const entry of damageEntries) {
        intents.push({
          type: 'DAMAGE',
          entityId: entity.id,
          sourceEntityId: caster.id,
          damage: entry.damage,
          damageType: entry.damageType,
        });
      }
    }

    // Отталкивание на одну клетку в сторону от точки приземления.
    const pushDx = Math.sign(entity.x - target.x);
    const pushDy = Math.sign(entity.y - target.y);

    if (pushDx !== 0 || pushDy !== 0) {
      intents.push({
        type: 'PUSH',
        entityId: entity.id,
        dx: pushDx,
        dy: pushDy,
        sourceEntityId: caster.id,
      });
    }
  }

  return intents;
}

export const swoopSkill: SkillExecutor = {
  id: 'swoop',

  getTargetMode(): TargetMode {
    return { type: 'single', range: SWOOP_JUMP_RADIUS };
  },

  getValidTargets(state: GameState, caster: Entity): Position[] {
    return getJumpTargets(state, caster);
  },

  preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
    if (!hoveredTarget) return [];
    return resolveSwoopIntents(state, caster, [hoveredTarget]);
  },

  getAffectedPositions(_state: GameState, _caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Position[] {
    if (!hoveredTarget) return [];

    const positions: Position[] = [];
    for (let dy = -SWOOP_AOE_RADIUS; dy <= SWOOP_AOE_RADIUS; dy++) {
      for (let dx = -SWOOP_AOE_RADIUS; dx <= SWOOP_AOE_RADIUS; dx++) {
        positions.push({ x: hoveredTarget.x + dx, y: hoveredTarget.y + dy });
      }
    }
    return positions;
  },

  resolve(state: GameState, caster: Entity, targets: Position[]): Intent[] {
    return resolveSwoopIntents(state, caster, targets);
  },
};
