/**
 * Исполнители интентов тайловых эффектов.
 *
 * Ответственность:
 * - Создание, удаление и тик тайловых эффектов.
 * - Порождение событий TILE_EFFECT_CHANGED / TILE_EFFECT_REMOVED.
 */

import type {GameState} from '@simulation/types.ts';
import type {
  IntentExecutor,
  RemoveTileEffectIntent,
  SpawnTileEffectIntent,
  TickTileEffectsIntent,
  ApplyTileEffectStatusIntent,
  RemoveTileEffectStatusIntent,
  TileEffectInstance,
} from '@simulation/systems/intents/types.ts';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types.ts';
import type {TileEffectStatusInstance} from '@simulation/core-types.ts';
import {tryGetTileEffect} from '@content/registry.ts';
import {getTileEffectStatusTemplate} from '@simulation/systems/tile-effects/tile-effect-status-template.ts';
import {resolveStatusConflicts} from '@simulation/systems/statuses/resolve-status-conflicts.ts';

/**
 * Создаёт экземпляр тайлового эффекта с заданными параметрами.
 * Если шаблон загружен, длительность, слой и порядок отрисовки берутся из него.
 * Совместимость тайловых эффектов (blockedBy / mutuallyExclusive) проверяется
 * в executeSpawnTileEffectIntent перед вызовом этой функции.
 */
function createTileEffectInstance(effectType: string, duration: number): TileEffectInstance {
  const template = tryGetTileEffect(effectType);
  return {
    type: effectType,
    duration,
    layer: template?.layer ?? 'cover',
    statusEffects: [],
    renderOrder: template?.renderOrder ?? 1,
  };
}

/**
 * Возвращает ячейку тайловых эффектов по координатам, гарантируя,
 * что объект существует (для восстановления после десериализации).
 */
function ensureTileEffectsCell(
  state: GameState,
  x: number,
  y: number,
): import('@simulation/core-types.ts').TileEffects {
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
    return {};
  }
  const row = state.tileEffects[y];
  if (!row) return {};
  let cell = row[x];
  if (!cell) {
    cell = {};
    row[x] = cell;
  }
  return cell;
}

export const executeSpawnTileEffectIntent: IntentExecutor<SpawnTileEffectIntent> = (
  state: GameState,
  intent: SpawnTileEffectIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const { x, y } = intent.position;
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
    return null;
  }

  const cell = ensureTileEffectsCell(state, x, y);
  const template = tryGetTileEffect(intent.effectType);
  const duration = intent.duration ?? template?.duration ?? 4;

  // Блокировка: если на клетке есть эффект из blockedByTileEffects, спавн не происходит.
  for (const blocker of template?.blockedByTileEffects ?? []) {
    if (cell[blocker] !== undefined) {
      return null;
    }
  }

  // Удаляем конфликтующие эффекты перед созданием нового, чтобы породить TILE_EFFECT_REMOVED.
  for (const existingType of Object.keys(cell)) {
    if (template?.mutuallyExclusiveWithTileEffects.includes(existingType)) {
      executeRemoveTileEffectIntent(
        state,
        { type: 'REMOVE_TILE_EFFECT', effectType: existingType, position: { x, y } },
        builder,
        parent,
      );
    }
  }

  const existingEffect = cell[intent.effectType];
  if (!existingEffect) {
    cell[intent.effectType] = createTileEffectInstance(intent.effectType, duration);
  } else {
    existingEffect.duration = duration;
  }

  return builder.addChild(parent, {
    type: 'TILE_EFFECT_CHANGED',
    effectType: intent.effectType,
    position: { x, y },
    isNew: !existingEffect,
  });
};

export const executeRemoveTileEffectIntent: IntentExecutor<RemoveTileEffectIntent> = (
  state: GameState,
  intent: RemoveTileEffectIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const { x, y } = intent.position;
  const cell = ensureTileEffectsCell(state, x, y);
  if (cell[intent.effectType] === undefined) {
    return null;
  }

  delete cell[intent.effectType];

  return builder.addChild(parent, {
    type: 'TILE_EFFECT_REMOVED',
    effectType: intent.effectType,
    position: { x, y },
  });
};

export const executeTickTileEffectsIntent: IntentExecutor<TickTileEffectsIntent> = (
  state: GameState,
  _intent: TickTileEffectsIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const removed: Array<{ effectType: string; x: number; y: number }> = [];
  let lastNode: ExecutionNode | null = null;

  // Детерминированный обход: сначала по строкам (y), затем по столбцам (x).
  for (let y = 0; y < state.map.height; y++) {
    const row = state.tileEffects[y];
    if (!row) continue;
    for (let x = 0; x < state.map.width; x++) {
      const cell = row[x];
      if (!cell) continue;
      for (const effectType of Object.keys(cell)) {
        const effect = cell[effectType];
        if (!effect) continue;

        // Некоторые материалы (например, масло) не исчезают сами по себе.
        // Их длительность уменьшается только при наличии указанных статусов.
        const template = tryGetTileEffect(effectType);
        const decayStatuses = template?.durationDecreasesWhenHasStatus ?? [];
        const shouldDecay = decayStatuses.length === 0 || effect.statusEffects.some((s) => decayStatuses.includes(s.type));
        if (!shouldDecay) {
          continue;
        }

        effect.duration -= 1;

        if (effect.duration > 0) {
          // Живой тайловый эффект тикает: сначала сам эффект, затем его статусы.
          lastNode = builder.addChild(parent, {
            type: 'TILE_EFFECT_TICKED',
            effectType,
            position: { x, y },
          });
          const aliveStatuses: TileEffectStatusInstance[] = [];
          for (const status of effect.statusEffects) {
            const statusTemplate = getTileEffectStatusTemplate(status.type);
            const isInfinite = statusTemplate?.neverExpires ?? false;

            if (!isInfinite) {
              status.duration -= 1;
            }

            lastNode = builder.addChild(parent, {
              type: 'TILE_EFFECT_STATUS_TICKED',
              effectType,
              statusType: status.type,
              position: { x, y },
            });

            if (isInfinite || status.duration > 0) {
              aliveStatuses.push(status);
            } else {
              lastNode = builder.addChild(parent, {
                type: 'TILE_EFFECT_STATUS_REMOVED',
                effectType,
                statusType: status.type,
                position: { x, y },
              });
            }
          }
          effect.statusEffects = aliveStatuses;
        } else {
          // Эффект истёк — его статусы удалятся вместе с ним без отдельных событий.
          removed.push({ effectType, x, y });
        }
      }
    }
  }

  // Удаляем истёкшие эффекты и порождаем события.
  for (const { effectType, x, y } of removed) {
    const cell = state.tileEffects[y]?.[x];
    if (cell) {
      delete cell[effectType];
    }
    lastNode = builder.addChild(parent, {
      type: 'TILE_EFFECT_REMOVED',
      effectType,
      position: { x, y },
    });
  }

  return lastNode;
};

/**
 * Накладывает статус на тайловый эффект.
 *
 * Проверки:
 * - Позиция в пределах карты.
 * - Тайловый эффект effectType присутствует на клетке.
 * - Шаблон эффекта разрешает этот статус через canHaveStatus.
 * - Шаблон статуса не блокируется уже существующими статусами через blockedBy.
 *
 * Применяет взаимоисключение: снимает конфликтующие статусы и порождает
 * TILE_EFFECT_STATUS_REMOVED для каждого снятого.
 * Если статус уже есть — обновляет длительность, иначе добавляет новый экземпляр.
 * Порождает TILE_EFFECT_STATUS_APPLIED с итоговой длительностью.
 */
export const executeApplyTileEffectStatusIntent: IntentExecutor<ApplyTileEffectStatusIntent> = (
  state: GameState,
  intent: ApplyTileEffectStatusIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const { x, y } = intent.position;
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
    return null;
  }

  const cell = ensureTileEffectsCell(state, x, y);
  const effect = cell[intent.effectType];
  if (!effect) {
    return null;
  }

  const effectTemplate = tryGetTileEffect(intent.effectType);
  if (!effectTemplate) {
    return null;
  }

  if (!effectTemplate.canHaveStatus.includes(intent.statusType)) {
    return null;
  }

  const statusTemplate = getTileEffectStatusTemplate(intent.statusType);
  if (!statusTemplate) {
    return null;
  }

  // Разрешаем конфликты blockedBy / mutuallyExclusiveWith через общий хелпер.
  const conflictResult = resolveStatusConflicts(
    effect.statusEffects,
    { blockedBy: statusTemplate.blockedBy, mutuallyExclusiveWith: statusTemplate.mutuallyExclusiveWith },
  );

  if (conflictResult.blockedBy) {
    return null;
  }

  for (const exclusiveType of conflictResult.removedTypes) {
    const index = effect.statusEffects.findIndex((status) => status.type === exclusiveType);
    if (index >= 0) {
      effect.statusEffects.splice(index, 1);
      builder.addChild(parent, {
        type: 'TILE_EFFECT_STATUS_REMOVED',
        effectType: intent.effectType,
        statusType: exclusiveType,
        position: { x, y },
      });
    }
  }

  const duration = intent.duration ?? statusTemplate.duration;
  const existingIndex = effect.statusEffects.findIndex((status) => status.type === intent.statusType);
  if (existingIndex >= 0) {
    effect.statusEffects[existingIndex] = {
      ...effect.statusEffects[existingIndex]!,
      duration,
    };
  } else {
    const newStatus: TileEffectStatusInstance = {
      type: intent.statusType,
      duration,
      renderOrder: statusTemplate.renderOrder,
    };
    effect.statusEffects.push(newStatus);
  }

  return builder.addChild(parent, {
    type: 'TILE_EFFECT_STATUS_APPLIED',
    effectType: intent.effectType,
    statusType: intent.statusType,
    position: { x, y },
    duration,
    sourceEntityId: intent.sourceEntityId ?? null,
  });
};

/**
 * Удаляет статус с тайлового эффекта и порождает TILE_EFFECT_STATUS_REMOVED.
 * Возвращает null, если эффект или статус отсутствуют.
 */
export const executeRemoveTileEffectStatusIntent: IntentExecutor<RemoveTileEffectStatusIntent> = (
  state: GameState,
  intent: RemoveTileEffectStatusIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const { x, y } = intent.position;
  if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
    return null;
  }

  const cell = ensureTileEffectsCell(state, x, y);
  const effect = cell[intent.effectType];
  if (!effect) {
    return null;
  }

  const index = effect.statusEffects.findIndex((status) => status.type === intent.statusType);
  if (index < 0) {
    return null;
  }

  effect.statusEffects.splice(index, 1);

  return builder.addChild(parent, {
    type: 'TILE_EFFECT_STATUS_REMOVED',
    effectType: intent.effectType,
    statusType: intent.statusType,
    position: { x, y },
  });
};
