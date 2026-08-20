/**
 * Чистые утилиты для ИИ-стратегий.
 *
 * Ответственность:
 * - Проверка зрения (радиус + LOS).
 * - Управление подготовленными способностями (prepare / cancel).
 * - Хелперы для генерации GameAction (endTurn).
 * - Общий FSM «охотника» (updateHunterState / handleHunterWorldChange /
 *   engagePlayer / decideHunterAction) — база hunter-подобных стратегий
 *   (hunter, guardian-boss), чтобы логика погони не дублировалась.
 *
 * Правила:
 * - Никаких побочных эффектов, кроме мутации actor.aiState (часть GameState).
 * - Все функции детерминированы при одинаковом state.
 *
 * Примечание:
 * - Логика передвижения и ближнего боя вынесена в тактический реестр
 *   {@link ./tactics}, чтобы стратегии могли переиспользовать её
 *   без дублирования.
 */

import type {ExecutionBuilder, ExecutionNode, GameAction} from '@simulation/systems/actions/types';
import type {AiActor, EnemyEntity, GameState, Position} from '@simulation/types';
import {computeFOV} from '@simulation/systems/fov';
import {chebyshevDistance} from '@utils/math';
import {getPreparableAbilities} from './cast-helpers';
import {getSkillExecutor} from '@simulation/skills/skillExecutor';
import type {WorldChange} from './perception-types';
import {closeCombat, findVisibleAttackTarget, moveToward, attackTarget} from './tactics';
import {isRooted} from '@simulation/systems/rooted-helper';
import {isEntityConcealedFrom} from '@simulation/state';

// ─────────────────────────────────────────────
// Зрение
// ─────────────────────────────────────────────

/**
 * Проверяет, видит ли враг указанную позицию.
 * Использует тот же алгоритм recursive shadowcasting, что и игрок,
 * с радиусом обзора врага (aiSightRadius).
 *
 * Сущности (другие враги) НЕ блокируют зрение — только стены.
 * Правило сокрытия: позиция с concealing-эффектом (мука и т.п.) видна
 * только с дистанции ≤ 1 — что там находится, враг издалека не различает.
 */
export function canSeePosition(
  enemy: EnemyEntity,
  state: GameState,
  position: Position,
): boolean {
  if (isEntityConcealedFrom(state, position, enemy)) return false;
  const visible = computeFOV(state, enemy.x, enemy.y, enemy.aiSightRadius);
  return visible.some((pos) => pos.x === position.x && pos.y === position.y);
}

/**
 * Проверяет, видит ли враг игрока.
 * Использует тот же алгоритм recursive shadowcasting, что и игрок,
 * с радиусом обзора врага (aiSightRadius).
 *
 * Сущности (другие враги) НЕ блокируют зрение — только стены.
 * Учитывает сокрытие: игрок на concealing-клетке виден только вплотную.
 */
export function canSeePlayer(enemy: EnemyEntity, state: GameState): boolean {
  return canSeePosition(enemy, state, state.player);
}

// ─────────────────────────────────────────────
// Каст способностей
// ─────────────────────────────────────────────

/**
 * Возвращает клетки из списка, отсортированные по расстоянию до игрока.
 * При равенстве расстояний сохраняется исходный порядок.
 */
export function sortByDistanceToPlayer(targets: Position[], player: Position): Position[] {
  return [...targets].sort((a, b) => {
    const distA = chebyshevDistance(a, player);
    const distB = chebyshevDistance(b, player);
    return distA - distB;
  });
}

/**
 * Проверяет, что выбранная клетка попадает в зону действия способности.
 * Используется для скиллов, целью которых является не сам игрок,
 * а клетка (например, прыжок или AoE-зона).
 */
export function canAffectPlayer(
  state: GameState,
  caster: EnemyEntity,
  executor: NonNullable<ReturnType<typeof getSkillExecutor>>,
  target: Position,
): boolean {
  const affected = executor.getAffectedPositions(state, caster, [target], target);
  const player = state.player;
  return affected.some((pos) => pos.x === player.x && pos.y === player.y);
}

/**
 * Выбирает цели для способности AI с приоритетом на игрока.
 * Для single-режима возвращает одну цель, для multi — до count целей.
 * Если игрок не является валидной целью (например, скилл приземляется в пустую клетку),
 * выбирается ближайшая к игроку клетка, зона действия которой достаёт до игрока.
 * Возвращает null, если executor не найден, нет валидных целей или
 * ни одна цель не может задеть игрока.
 */
export function chooseAbilityTargets(
  state: GameState,
  caster: EnemyEntity,
  abilityId: string,
): Position[] | null {
  const executor = getSkillExecutor(abilityId);
  if (!executor) {
    return null;
  }

  const targets = executor.getValidTargets(state, caster);
  if (targets.length === 0) {
    return null;
  }

  const player = state.player;
  const targetMode = executor.getTargetMode(state, caster);
  const targetWithPlayer = targets.find((t) => t.x === player.x && t.y === player.y);

  if (targetMode.type === 'multi') {
    // Мульти-таргетные скиллы (magic_slap) целятся в существа;
    // без игрока в списке целей смысла кастовать нет.
    if (!targetWithPlayer) {
      return null;
    }
    const count = targetMode.count;
    const rest = targets.filter(
      (t) => t.x !== targetWithPlayer.x || t.y !== targetWithPlayer.y,
    );
    const closestRest = sortByDistanceToPlayer(rest, player).slice(0, count - 1);
    return [targetWithPlayer, ...closestRest];
  }

  if (targetWithPlayer) {
    return [targetWithPlayer];
  }

  // Single-таргетные скиллы с пустыми клетками (прыжок, AoE-зона):
  // выбираем ближайшую к игроку клетку, зона которой задевает игрока.
  const candidates = sortByDistanceToPlayer(targets, player).filter((target) =>
    canAffectPlayer(state, caster, executor, target),
  );
  const best = candidates[0];
  return best ? [best] : null;
}

// ─────────────────────────────────────────────
// Подготовка скилла AI
// ─────────────────────────────────────────────

/**
 * Сбрасывает подготовленную способность AI и возвращает её данные.
 * Используется при оглушении или других отменах подготовки.
 */
export function cancelPreparedAbility(
  enemy: EnemyEntity,
): { abilityId: string; targets: Position[] } | null {
  const prepared = enemy.aiState.preparedAbility;
  if (!prepared) {
    return null;
  }
  enemy.aiState.preparedAbility = null;
  return prepared;
}

/**
 * Подготавливает скилл к выполнению в следующий ход.
 * Мутирует enemy.aiState.preparedAbility и эмитит событие ABILITY_PREPARED
 * как дочернее к parent через builder.
 */
export function prepareAbility(
  enemy: EnemyEntity,
  abilityId: string,
  targets: Position[],
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): void {
  enemy.aiState.preparedAbility = { abilityId, targets };

  builder.addChild(parent, {
    type: 'ABILITY_PREPARED', isFieldEvent: false,
    entityId: enemy.id,
    abilityId,
    targets,
    from: { x: enemy.x, y: enemy.y },
  });
}

/**
 * Пытается подготовить скилл к выполнению в следующий ход.
 * Возвращает true, если нашёлся подходящий preparable скилл с целью
 * и подготовка была произведена как side-effect.
 * Иначе false.
 */
export function tryPrepareAbility(
  enemy: EnemyEntity,
  state: GameState,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): boolean {
  const preparableAbilities = getPreparableAbilities(enemy, state);
  if (preparableAbilities.length === 0) {
    return false;
  }

  const ability = preparableAbilities[0]!;
  const chosenTargets = chooseAbilityTargets(state, enemy, ability.templateId);
  if (!chosenTargets || chosenTargets.length === 0) {
    return false;
  }

  prepareAbility(enemy, ability.templateId, chosenTargets, builder, parent);
  return true;
}

// ─────────────────────────────────────────────
// Утилиты для GameAction
// ─────────────────────────────────────────────

/** Возвращает END_TURN-действие для указанного AI-актора. */
export function endTurn(actor: AiActor): GameAction {
  return { type: 'END_TURN', entityId: actor.id };
}

// ─────────────────────────────────────────────
// Общий FSM «охотника»
// ─────────────────────────────────────────────
//
// База hunter-подобных стратегий (hunter, guardian-boss): погоня за игроком,
// возврат к точке спавна, ближний бой. Стратегии переиспользуют эти хелперы,
// не дублируя логику (AI_SYSTEM.md).

/**
 * Переводит охотника в режим погони на указанную позицию.
 * Используется единообразно в onWorldChange и updateHunterState.
 */
export function engagePlayer(enemy: EnemyEntity, target: Position): void {
  enemy.aiState.mode = 'chase';
  updateChaseTarget(enemy, target);
}

/**
 * Обновляет цель погони, не меняя режим.
 */
function updateChaseTarget(enemy: EnemyEntity, target: Position): void {
  enemy.aiState.targetX = target.x;
  enemy.aiState.targetY = target.y;
}

/**
 * Обрабатывает изменение мира, замеченное охотником.
 *
 * Стратегия сама проверяет видимость, так как только она знает,
 * какие объекты для неё значимы.
 */
export function handleHunterWorldChange(enemy: EnemyEntity, state: GameState, change: WorldChange): void {
  switch (change.kind) {
    case 'entity_moved': {
      // Охотник реагирует только на игрока.
      if (change.entityId !== state.player.id) return;

      if (canSeePosition(enemy, state, change.to)) {
        engagePlayer(enemy, change.to);
      }
      break;
    }

    case 'door_opened':
    case 'door_closed': {
      // Реагируем только если игрок стал виден (или всё ещё виден)
      // в результате изменения двери.
      if (canSeePlayer(enemy, state)) {
        engagePlayer(enemy, state.player);
      }
      break;
    }
  }
}

/**
 * Обновляет состояние конечного автомата охотника.
 *
 * Мутирует только `enemy.aiState` — никакие другие части state не трогаются.
 */
export function updateHunterState(enemy: EnemyEntity, state: GameState): void {
  const seesPlayer = canSeePlayer(enemy, state);

  switch (enemy.aiState.mode) {
    case 'idle': {
      if (seesPlayer) {
        engagePlayer(enemy, state.player);
      }
      break;
    }

    case 'chase': {
      if (seesPlayer) {
        // Обновляем target на актуальную позицию игрока.
        updateChaseTarget(enemy, state.player);
      } else if (
        enemy.aiState.targetX !== null &&
        enemy.aiState.targetY !== null &&
        enemy.x === enemy.aiState.targetX &&
        enemy.y === enemy.aiState.targetY
      ) {
        // Дошли до последней известной позиции, цели нет — возвращаемся домой.
        enemy.aiState.mode = 'return';
        enemy.aiState.targetX = null;
        enemy.aiState.targetY = null;
      }
      break;
    }

    case 'return': {
      if (seesPlayer) {
        engagePlayer(enemy, state.player);
      } else if (enemy.x === enemy.aiState.homeX && enemy.y === enemy.aiState.homeY) {
        enemy.aiState.mode = 'idle';
      }
      break;
    }
  }
}

/**
 * Охотничье поведение за один шаг решения стратегии:
 * видимая цель — ближний бой (атака/шаг по кратчайшему пути),
 * иначе действие по FSM-режиму (idle/chase/return).
 *
 * Чистая функция выбора: не эмитит события, но может мутировать aiState
 * (защитный переход chase → return при потерянной цели), как и hunter.
 */
export function decideHunterAction(enemy: EnemyEntity, state: GameState): GameAction {
  // Обездвиженный актор не перемещается самостоятельно: атакует видимую цель,
  // только если она уже в соседней клетке, иначе завершает ход.
  if (isRooted(enemy)) {
    const rootedTarget = findVisibleAttackTarget(enemy, state);
    if (rootedTarget && chebyshevDistance({x: enemy.x, y: enemy.y}, rootedTarget) === 1) {
      return attackTarget(enemy, rootedTarget);
    }
    return endTurn(enemy);
  }

  // Приоритет 1: если видим цель — сразу идём к ней вплотную и атакуем.
  const visibleTarget = findVisibleAttackTarget(enemy, state);
  if (visibleTarget) {
    const result = closeCombat(enemy, state, visibleTarget);
    if (result.kind !== 'blocked') {
      return result.action;
    }
    return endTurn(enemy);
  }

  // Приоритет 2: действуем согласно текущему FSM-режиму.
  switch (enemy.aiState.mode) {
    case 'idle': {
      return endTurn(enemy);
    }

    case 'chase': {
      const tx = enemy.aiState.targetX;
      const ty = enemy.aiState.targetY;

      if (tx === null || ty === null) {
        // Защита: target потерян — переключаемся в return.
        enemy.aiState.mode = 'return';
        return endTurn(enemy);
      }

      // targetX/Y — последняя известная позиция цели, а не сама цель.
      // Нужно обязательно встать на эту клетку, чтобы FSM смог перейти
      // в return, а не пытаться атаковать пустую клетку рядом с ней.
      const result = moveToward(enemy, state, { x: tx, y: ty });
      if (result.kind === 'move' || result.kind === 'interact') {
        return result.action;
      }
      return endTurn(enemy);
    }

    case 'return': {
      const home: Position = { x: enemy.aiState.homeX, y: enemy.aiState.homeY };
      const result = moveToward(enemy, state, home);
      if (result.kind === 'move' || result.kind === 'interact') {
        return result.action;
      }
      return endTurn(enemy);
    }
  }
}
