/**
 * Резолвер стоимости действий в очках действий (AP).
 *
 * Отвечает за вычисление стоимости любого `GameAction` на основе текущего
 * состояния игры. Центральное списание AP происходит в `GameSimulation.executeAction`.
 */

import {tryGetAbility, tryGetItem, tryGetPoi, tryGetTerrain} from '@content/registry';
import {MAX_ABILITY_ALL_AP_COST} from '@utils/constants';
import type {GameAction} from '@simulation/core-types.ts';
import type {GameState} from '@simulation/types.ts';

export type ActionPointCostResolver = {
  getCost(action: GameAction, state: GameState): number;
};

/**
 * Базовая реализация резолвера стоимости AP.
 *
 * Правила:
 * - MOVE — стоимость входа на целевую клетку из шаблона террейна (`moveCost`), fallback = 1
 * - ATTACK — 1 AP
 * - END_TURN — 0 AP
 * - USE_ABILITY — берётся из `apCost` шаблона способности, fallback = 1
 * - USE_ITEM — берётся из `apCost` шаблона предмета, fallback = 1
 * - EQUIP / UNEQUIP — 1 AP
 * - INTERACT — 1 AP; для poi с окном и `chargeSpentOn: 'resolution'` — 0 AP
 *   (открытие окна бесплатно, AP списывается при выходе из окна — выбором опции)
 * - RESOLVE_POI_CHOICE — 1 AP (выбор = завершение взаимодействия с окном poi)
 *
 * Известное ограничение итерации: автопуть и AI-pathfinding (`findPath`)
 * остаются равностоимостными — `moveCost` учитывается только при списании AP
 * за одиночный шаг, а не при выборе маршрута.
 */
export class DefaultActionPointCostResolver
    implements ActionPointCostResolver {

  getCost(action: GameAction, state: GameState): number {
    switch (action.type) {
      case 'MOVE': {
        const actor = state.entities.get(action.entityId);
        if (!actor) return 1;
        const terrainId = state.map.tiles[actor.y + action.dy]?.[actor.x + action.dx];
        return (terrainId !== undefined ? tryGetTerrain(terrainId)?.moveCost : undefined) ?? 1;
      }

      case 'INTERACT': {
        // Оконный poi с зарядом на выбор: открытие окна бесплатно.
        const target = state.entities.get(action.targetId);
        if (target?.type === 'poi') {
          const template = tryGetPoi(target.templateId);
          if (template?.window && template.chargeSpentOn === 'resolution') {
            return 0;
          }
        }
        return 1;
      }

      case 'ATTACK':
      case 'RESOLVE_POI_CHOICE':
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
      case 'DEBUG_SPAWN_TILE_EFFECT':
      case 'DEBUG_SET_TERRAIN':
        return 0;

      default: {
        // При добавлении нового действия стоимость должна быть явно определена.
        const exhaustive: never = action as never;
        throw new Error(`Неизвестный тип действия: ${(exhaustive as { type?: string }).type ?? '?'}`);
      }
    }
  }
}
