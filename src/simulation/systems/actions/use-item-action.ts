/**
 * Обработчик действия USE_ITEM — использование расходуемого предмета из инвентаря.
 *
 * Логика:
 * - Проверяет, что предмет есть в инвентаре и является consumable.
 * - Разрешает эффект в зависимости от consumable.effect:
 *   heal → HEAL + REMOVE_ITEM
 *   buff → APPLY_STATUS + REMOVE_ITEM
 *   applyStatus → APPLY_STATUS на себя по каждому статусу из consumable.statuses + REMOVE_ITEM
 *   spawn_tile_effect → SPAWN_TILE_EFFECT + REMOVE_ITEM
 *   damage → TILE_EXPLOSION + REMOVE_ITEM
 *   Прочие эффекты (teleport, identify) пока не реализованы.
 */

import {GameState, Position} from "@simulation/types.ts";
import type {StatusEffectType} from "@simulation/core-types.ts";
import {getItem} from "@content/registry";
import type {ItemTemplate} from "@content/schemas";
import {ActionHandler, ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";
import {executeIntents} from "@simulation/systems/intents/execute-intent.ts";
import {terrainHasTag} from "@simulation/state.ts";
import {getVisiblePositionsWithinRange, getPositionsInRadius} from "@simulation/skills/targeting";
import {getEffectiveThrowRange} from "@simulation/systems/stats/effective-stats.ts";

/**
 * Итоговая дальность броска расходника: `range` шаблона + стат `throwRange` бросающего
 * (фирменные свойства экипировки, реликвии, статусы).
 */
export function getConsumableThrowRange(
  template: ItemTemplate,
  entity: GameState['player'],
): number {
  const base = template.consumable?.range ?? 5;
  return base + getEffectiveThrowRange(entity);
}

export const useItemAction: ActionHandler = {

  validate(state: GameState, action) {
    if (action.type !== 'USE_ITEM') {
      return { ok: false, reasonCode: 'wrong_action_type' };
    }

    const player = state.player;
    const item = player.inventory.find(i => i.instanceId === action.itemInstanceId);
    if (!item) {
      return { ok: false, reasonCode: 'item_not_found' };
    }

    if (action.templateId !== undefined && action.templateId !== item.templateId) {
      return { ok: false, reasonCode: 'template_id_mismatch' };
    }

    const template = getItem(item.templateId);
    if (template.type !== 'consumable' || !template.consumable) {
      return { ok: false, reasonCode: 'not_consumable' };
    }

    const supportedEffects = ['heal', 'buff', 'applyStatus', 'spawn_tile_effect', 'damage'];
    if (!supportedEffects.includes(template.consumable.effect)) {
      return { ok: false, reasonCode: 'unsupported_effect' };
    }

    // Эффекты с броском по клетке: выбор цели в дальности броска и в LOS.
    if (template.consumable.effect === 'spawn_tile_effect' || template.consumable.effect === 'damage') {
      if (!action.targetPosition) {
        return { ok: false, reasonCode: 'missing_target_position' };
      }
      const range = getConsumableThrowRange(template, player);
      const validTargets = getVisiblePositionsWithinRange(state, player, range);
      const isValid = validTargets.some(
        (p: Position) => p.x === action.targetPosition!.x && p.y === action.targetPosition!.y,
      );
      if (!isValid) {
        return { ok: false, reasonCode: 'invalid_target_position' };
      }
    }

    return { ok: true };
  },

  resolve(state: GameState, action) {
    if (action.type !== 'USE_ITEM') {
      return [];
    }

    const player = state.player;
    const item = player.inventory.find(i => i.instanceId === action.itemInstanceId);
    if (!item) {
      return [];
    }
    const template = getItem(item.templateId);
    if (template.type !== 'consumable' || !template.consumable) {
      return [];
    }
    const effect = template.consumable;

    const intents: Intent[] = [];

    switch (effect.effect) {
      case 'heal': {
        intents.push({
          type: 'HEAL',
          entityId: action.entityId,
          amount: effect.value ?? 0,
        });
        break;
      }
      case 'buff': {
        // TODO: определить конкретный статус-эффект на основе template
        intents.push({
          type: 'APPLY_STATUS',
          entityId: action.entityId,
          sourceEntityId: action.entityId,
          status: {
            type: 'regenerating',
            duration: effect.duration ?? 3,
            value: effect.value ?? 0,
            statModifiers: null,
          },
        });
        break;
      }
      case 'applyStatus': {
        // Наложение списка статусов на себя (ритуальные расходники кровавой ветки).
        // Схема гарантирует непустой statuses для этого эффекта.
        for (const statusEntry of effect.statuses ?? []) {
          intents.push({
            type: 'APPLY_STATUS',
            entityId: action.entityId,
            sourceEntityId: action.entityId,
            status: {
              // statusType в схеме — произвольная строка; существование статуса
              // в реестре проверяет scripts/validate-content.ts, поэтому каст нужен.
              type: statusEntry.statusType as StatusEffectType,
              duration: statusEntry.duration,
              value: 0,
              statModifiers: null,
            },
          });
        }
        break;
      }
      case 'spawn_tile_effect': {
        if (!action.targetPosition) {
          return [];
        }
        const effectType = effect.tileEffectType;
        if (!effectType) {
          return [];
        }
        const radius = effect.radius ?? 1;
        const positions = getPositionsInRadius(state, action.targetPosition, radius)
          .filter(pos => terrainHasTag(state.map.tiles[pos.y]?.[pos.x], 'ground'));
        for (const pos of positions) {
          intents.push({
            type: 'SPAWN_TILE_EFFECT',
            effectType,
            position: pos,
          });
        }
        break;
      }
      case 'damage': {
        // Брошенная бомба: площадной взрыв в точке падения.
        // Урон по клеткам раскладывает реакция на TILE_EXPLODED.
        if (!action.targetPosition) {
          return [];
        }
        intents.push({
          type: 'TILE_EXPLOSION',
          position: action.targetPosition,
          sourceEntityId: action.entityId,
          damage: effect.value ?? 0,
          radius: effect.radius ?? 0,
          tags: [effect.damageTag ?? 'damage.physical.blunt'],
        });
        break;
      }
      default: {
        // teleport, identify — пока не реализованы
        return [];
      }
    }

    intents.push(
      { type: 'REMOVE_ITEM', entityId: action.entityId, itemInstanceId: item.instanceId, templateId: item.templateId },
    );

    return intents;
  },

  execute(state: GameState, action, intents: Intent[], executionBuilder: ExecutionBuilder, parentNode: ExecutionNode) {
    executeIntents(state, intents, executionBuilder, parentNode);
  },
};
