import { GameState, Entity } from '@simulation/types';
import { DashIntent, IntentExecutor } from '@simulation/systems/intents/types';
import { ExecutionBuilder, ExecutionNode } from '@simulation/systems/actions/types';
import { findEntity, isBlocked, isActor, findDoorAt, isDamageable, isCombatEntity } from '@simulation/state';
import { damageFormulas } from '@simulation/skills/damageFormula';
import { executeDamageIntent } from '@simulation/systems/intents/attack-intent-executer';
import { executePushIntent } from '@simulation/systems/intents/push-intent-executer';
import { executeBumpIntent } from '@simulation/systems/intents/bump-intent-executor';
import { executeOpenDoorIntent } from '@simulation/systems/intents/door-intent-executor';
import { emitEntityMoved } from '@simulation/systems/intents/move-intent-executer';

/**
 * Базовый урон при столкновении рывка с актором.
 */
const DASH_BUMP_BASE_DAMAGE = 5;

/**
 * Возвращает уровень скилла рывка у кастера.
 */
function getSkillLevel(caster: Entity): number {
  if (caster.type !== 'player') return 1;
  return caster.abilities.find(a => a.templateId === 'dash')?.level ?? 1;
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
 * Пытается переместить кастера на одну клетку в направлении рывка.
 * Если целевая клетка занята, возвращает null.
 */
function moveCasterOneStep(
  state: GameState,
  caster: Entity,
  intent: DashIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): ExecutionNode | null {
  return emitEntityMoved(state, caster.id, intent.dx, intent.dy, builder, parent, 'dash');
}

/**
 * Исполняет интент рывка DASH.
 *
 * Контракт:
 * - Один intent описывает рывок на заданное количество клеток в одном направлении.
 * - Executor сам проходит каждую клетку пути и разрешает столкновения.
 * - Актер останавливается на клетке перед любым объектом (стеной, актором
 *   или другим непроходимым объектом), независимо от того, получится ли
 *   оттолкнуть цель.
 * - Закрытая дверь на пути открывается и не блокирует движение.
 */
export const executeDashIntent: IntentExecutor<DashIntent> = (
  state: GameState,
  intent: DashIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const caster = findEntity(state, intent.entityId);
  if (!caster) return null;

  let lastNode: ExecutionNode | null = null;
  const skillLevel = getSkillLevel(caster);

  for (let step = 1; step <= intent.distance; step++) {
    const cellX = caster.x + intent.dx;
    const cellY = caster.y + intent.dy;

    // Стена или граница карты — остановка с отскоком.
    if (
      cellX < 0 ||
      cellX >= state.map.width ||
      cellY < 0 ||
      cellY >= state.map.height ||
      state.map.tiles[cellY]?.[cellX] === 'wall'
    ) {
      lastNode = executeBumpIntent(
        state,
        { type: 'BUMP', entityId: caster.id, position: { x: caster.x, y: caster.y }, dx: intent.dx, dy: intent.dy },
        builder,
        parent,
      );
      break;
    }

    // Закрытая дверь открывается, и кастер проходит через неё.
    const door = findDoorAt(state, cellX, cellY);
    if (door && !door.isOpen) {
      const openNode = executeOpenDoorIntent(
        state,
        { type: 'OPEN_DOOR', entityId: caster.id, targetPosition: { x: cellX, y: cellY } },
        builder,
        parent,
      );
      if (openNode) lastNode = openNode;

      const moveNode = moveCasterOneStep(state, caster, intent, builder, parent);
      if (moveNode) lastNode = moveNode;
      continue;
    }

    // Актор на пути — урон, отталкивание и остановка на клетке перед ним.
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
          const damageNode = executeDamageIntent(
            state,
            { type: 'DAMAGE', entityId: actor.id, sourceEntityId: caster.id, damage: entry.damage, damageType: entry.damageType },
            builder,
            parent,
          );
          if (damageNode) lastNode = damageNode;
        }
      }

      const pushNode = executePushIntent(
        state,
        { type: 'PUSH', entityId: actor.id, dx: intent.dx, dy: intent.dy, sourceEntityId: caster.id },
        builder,
        parent,
      );
      if (pushNode) lastNode = pushNode;

      // Кастер всегда остаётся на клетке перед целью и отскакивает.
      lastNode = executeBumpIntent(
        state,
        { type: 'BUMP', entityId: caster.id, position: { x: caster.x, y: caster.y }, dx: intent.dx, dy: intent.dy },
        builder,
        parent,
      );
      break;
    }

    // Любой другой непроходимый объект — остановка с отскоком.
    if (isBlocked(state, cellX, cellY)) {
      lastNode = executeBumpIntent(
        state,
        { type: 'BUMP', entityId: caster.id, position: { x: caster.x, y: caster.y }, dx: intent.dx, dy: intent.dy },
        builder,
        parent,
      );
      break;
    }

    // Пустая клетка — движение.
    const moveNode = moveCasterOneStep(state, caster, intent, builder, parent);
    if (moveNode) lastNode = moveNode;
  }

  return lastNode ?? parent;
};
