/**
 * Резолвер стоимости действий в очках действий (AP).
 *
 * Отвечает за вычисление стоимости любого `GameAction` на основе текущего
 * состояния игры. Центральное списание AP происходит в `GameSimulation.executeAction`.
 */

import { tryGetAbility, tryGetItem } from '@content/registry';
import { MAX_ABILITY_ALL_AP_COST } from '@utils/constants';
import type { GameAction } from '@simulation/core-types.ts';
import type { GameState } from '@simulation/types.ts';

export type ActionPointCostResolver = {
  getCost(action: GameAction, state: GameState): number;
};

/**
 * Базовая реализация резолвера стоимости AP.
 *
 * Правила:
 * - MOVE — 1 AP
 * - ATTACK — 1 AP
 * - END_TURN — 0 AP
 * - USE_ABILITY — берётся из `apCost` шаблона способности, fallback = 1
 * - USE_ITEM — берётся из `apCost` шаблона предмета, fallback = 1
 * - EQUIP / UNEQUIP — 1 AP
 * - INTERACT — 1 AP
 */
export class DefaultActionPointCostResolver
    implements ActionPointCostResolver {

  getCost(action: GameAction, state: GameState): number {
    switch (action.type) {
      case 'MOVE':
      case 'INTERACT':
      case 'ATTACK':
        return 1;

      case 'END_TURN':
        return 0;

      case 'USE_ABILITY': {
        const apCost = tryGetAbility(action.abilityId)?.apCost ?? 1;
        if (apCost === 'all') {
          const actor = state.entities.get(action.entityId);
          const currentAp = actor && 'ap' in actor ? actor.ap : 1;
          return Math.min(currentAp, MAX_ABILITY_ALL_AP_COST);
        }
        return apCost;
      }

      case 'USE_ITEM': {
        const actor = state.entities.get(action.entityId);
        if (!actor || !('inventory' in actor)) {
          return 1;
        }
        const item = actor.inventory.find(i => i.instanceId === action.itemInstanceId);
        if (!item) {
          return 1;
        }
        return tryGetItem(item.templateId)?.apCost ?? 1;
      }

      case 'EQUIP':
      case 'UNEQUIP':
        return 1;

      case 'DEBUG_ADD_ITEM':
      case 'DEBUG_SPAWN_ENTITY':
        return 0;

      default: {
        // При добавлении нового действия стоимость должна быть явно определена.
        const exhaustive: never = action as never;
        throw new Error(`Неизвестный тип действия: ${(exhaustive as { type?: string }).type ?? '?'}`);
      }
    }
  }
}
