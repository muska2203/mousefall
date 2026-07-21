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
  TileEffectInstance,
} from '@simulation/systems/intents/types.ts';
import type {ExecutionBuilder, ExecutionNode} from '@simulation/systems/actions/types.ts';
import {tryGetTileEffect} from '@content/registry.ts';

/**
 * Создаёт экземпляр тайлового эффекта с заданными параметрами.
 * Если шаблон загружен, длительность, слой и порядок отрисовки берутся из него.
 * На этапе 1 совместимость (blockedBy / mutuallyExclusive) не проверяется.
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
  const isNew = cell[intent.effectType] === undefined;
  const template = tryGetTileEffect(intent.effectType);
  const duration = intent.duration ?? template?.duration ?? 4;
  cell[intent.effectType] = createTileEffectInstance(intent.effectType, duration);

  return builder.addChild(parent, {
    type: 'TILE_EFFECT_CHANGED',
    effectType: intent.effectType,
    position: { x, y },
    isNew,
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
        effect.duration -= 1;
        if (effect.duration <= 0) {
          removed.push({ effectType, x, y });
        }
      }
    }
  }

  // Удаляем истёкшие эффекты и порождаем события.
  let lastNode: ExecutionNode | null = null;
  for (const { effectType, x, y } of removed) {
    const cell = state.tileEffects[y]![x];
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
