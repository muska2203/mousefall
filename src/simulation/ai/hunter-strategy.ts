/**
 * Стратегия "охотник".
 *
 * Поведение:
 * - Ищет атакуемую цель в пределах видимости (сейчас — только игрок).
 * - Если цель видна — сразу движется к ней вплотную по кратчайшему маршруту и атакует.
 * - Если цель потеряна во время погони — идёт к последней известной позиции,
 *   затем возвращается к точке спавна.
 *
 * Архитектура:
 * - Стратегия отвечает за порядок приоритетов и FSM-переходы.
 * - FSM и боевое поведение переиспользуются из {@link './ai-helpers'}
 *   (общая база hunter-подобных стратегий: hunter, guardian-boss).
 * - Конкретные действия (MOVE/ATTACK, поиск пути) делегируются
 *   тактическому реестру {@link './tactics'}.
 */

import {registerStrategy} from './strategy-registry';
import {
  decideHunterAction,
  endTurn,
  handleHunterWorldChange,
  updateHunterState,
} from './ai-helpers';
import {isEnemyEntity} from './ai-state';

registerStrategy('hunter', {
  updateState(actor, state) {
    if (!isEnemyEntity(actor)) return;
    updateHunterState(actor, state);
  },

  onWorldChange(actor, state, change) {
    if (!isEnemyEntity(actor)) return;
    handleHunterWorldChange(actor, state, change);
  },

  decideAction(actor, state, _builder, _parent) {
    if (!isEnemyEntity(actor)) {
      return endTurn(actor);
    }
    return decideHunterAction(actor, state);
  },
});
