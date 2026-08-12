/**
 * Стратегия первого босса «Кот-Страж» (guardian-boss).
 *
 * Источник требований: docs/game-design/first-boss-concept.md.
 *
 * Базис — охотничий FSM (переиспользован из ai-helpers). Поверх него:
 *
 * Стадия 1 (HP > 50%): преследование и ближний бой; в конце хода
 * (эвристика: AP ≤ 1 или содержательных действий больше нет) — подготовка
 * Налёта, если он доступен и есть точка приземления со столкновением игрока
 * (findCollisionLanding). Без геометрии столкновения Налёт придерживается.
 *
 * Переход на стадию 2 (первое пересечение порога 50% HP, проверка в updateState):
 * одноразовый флаг bossTransitionPending; на ближайшем decideAction босс
 * немедленно готовит Удар по земле и кастует Глухую оборону вместо обычного хода.
 *
 * Стадия 2 (HP ≤ 50%): приоритет комбо «Удар по земле + Глухая оборона»
 * (оба кулдауна 0): пока AP > 1 — преследование/атака, в конце хода —
 * подготовка Удара + каст Обороны (Оборона защищает подготовку в ход игрока
 * и спадает тиком до следующего хода босса). Налёт заполняет окна,
 * когда комбо на кулдауне.
 *
 * Подготовленная способность исполняется первым действием хода
 * с зафиксированными при подготовке целями. Под «Глухой обороной»
 * босс только завершает ход (canActorAct запрещает остальное);
 * подготовка при этом не сбрасывается.
 */

import {registerStrategy} from './strategy-registry';
import type {ExecutionBuilder, ExecutionNode, GameAction} from '@simulation/systems/actions/types';
import type {EnemyEntity} from '@simulation/types';
import {
  decideHunterAction,
  endTurn,
  handleHunterWorldChange,
  prepareAbility,
  updateHunterState,
} from './ai-helpers';
import {isEnemyEntity} from './ai-state';
import {findCollisionLanding, findVisibleAttackTarget} from './tactics';
import {isBulwarked} from '@simulation/systems/bulwark-helper';

/** Контентные id способностей босса (шаблоны src/content/templates/abilities/). */
const GROUND_SLAM_ID = 'ground_slam';
const BULWARK_ID = 'bulwark';
const GUARDIAN_SWOOP_ID = 'guardian_swoop';

/** Способность есть у врага и не на кулдауне. */
function isAbilityReady(enemy: EnemyEntity, abilityId: string): boolean {
  const ability = enemy.abilities.find(a => a.templateId === abilityId);
  return ability !== undefined && ability.currentCooldown === 0;
}

/**
 * Комбо «Удар по земле + Глухая оборона»:
 * готовит Удар (side-effect: ABILITY_PREPARED, исполнение на следующем ходу)
 * и возвращает действие каста Обороны — она защищает подготовку в ход игрока.
 * Оборона кастуется последней, так как запрещает все остальные действия.
 */
function prepareSlamAndCastBulwark(
  enemy: EnemyEntity,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): GameAction {
  prepareAbility(enemy, GROUND_SLAM_ID, [{x: enemy.x, y: enemy.y}], builder, parent);
  return {
    type: 'USE_ABILITY',
    entityId: enemy.id,
    abilityId: BULWARK_ID,
    targets: [{x: enemy.x, y: enemy.y}],
  };
}

registerStrategy('guardian-boss', {
  updateState(actor, state) {
    if (!isEnemyEntity(actor)) return;
    updateHunterState(actor, state);

    // Одноразовый переход на стадию 2 при пересечении порога 50% HP.
    // MVP-тайминг: проверка в начале хода босса, комбо — на этом же ходу
    // (decideAction, приоритет 3). Немедленная реакция посреди хода игрока — пост-MVP.
    if (!actor.aiState.bossStage && actor.hp * 2 <= actor.maxHp) {
      actor.aiState.bossStage = 2;
      actor.aiState.bossTransitionPending = true;
    }
  },

  onWorldChange(actor, state, change) {
    if (!isEnemyEntity(actor)) return;
    handleHunterWorldChange(actor, state, change);
  },

  decideAction(actor, state, builder, parent) {
    if (!isEnemyEntity(actor)) {
      return endTurn(actor);
    }
    const enemy = actor;

    // (1) Под «Глухой обороной» все действия запрещены — только конец хода.
    // Подготовленный скилл при этом не сбрасывается.
    if (isBulwarked(enemy)) {
      return endTurn(enemy);
    }

    // (2) Подготовленная способность — исполнить с зафиксированными целями.
    const prepared = enemy.aiState.preparedAbility;
    if (prepared) {
      return {
        type: 'USE_ABILITY',
        entityId: enemy.id,
        abilityId: prepared.abilityId,
        targets: prepared.targets,
      };
    }

    // (3) Переход на стадию 2: немедленное комбо вместо обычного хода.
    if (enemy.aiState.bossTransitionPending) {
      enemy.aiState.bossTransitionPending = false;
      return prepareSlamAndCastBulwark(enemy, builder, parent);
    }

    // Охотничье действие этого шага и эвристика «конца хода»:
    // AP ≤ 1 (атака/шаг больше не совместимы с кастом Обороны)
    // или содержательных действий больше нет.
    const hunterAction = decideHunterAction(enemy, state);
    const endOfTurn = enemy.ap <= 1 || hunterAction.type === 'END_TURN';

    // (4) Стадия 2, комбо доступно (оба кулдауна 0): в конце хода —
    // подготовка Удара + каст Обороны. Каст Обороны требует 1 AP.
    if (
      enemy.aiState.bossStage === 2 &&
      endOfTurn &&
      enemy.ap >= 1 &&
      isAbilityReady(enemy, GROUND_SLAM_ID) &&
      isAbilityReady(enemy, BULWARK_ID)
    ) {
      return prepareSlamAndCastBulwark(enemy, builder, parent);
    }

    // (5) Налёт: доступен, цель видна и есть точка приземления со столкновением —
    // подготовить в конце хода. Без геометрии столкновения скилл придерживается.
    if (endOfTurn && isAbilityReady(enemy, GUARDIAN_SWOOP_ID)) {
      const visibleTarget = findVisibleAttackTarget(enemy, state);
      if (visibleTarget) {
        const landing = findCollisionLanding(state, enemy, GUARDIAN_SWOOP_ID, visibleTarget);
        if (landing) {
          prepareAbility(enemy, GUARDIAN_SWOOP_ID, [landing], builder, parent);
          return endTurn(enemy);
        }
      }
    }

    // (6) Обычное охотничье поведение (преследование и ближний бой).
    return hunterAction;
  },
});
