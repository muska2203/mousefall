/**
 * Функции построения DisplayState и применения патчей.
 *
 * Правила:
 * - buildDisplayState создаёт копию GameState в терминах DisplayState.
 * - createPatch превращает одно GameEvent в DisplayPatch.
 * - applyPatch возвращает новый DisplayState, не мутируя исходный.
 */

import type {Entity, GameEvent, GameState, Position} from '@simulation/types';
import type {DisplayEntity, DisplayMap, DisplayPatch, DisplayState, DisplayTile, PresentationNode, TileEffectOverlay,} from './types';

/** Преобразовать Entity из Simulation в DisplayEntity. */
function toDisplayEntity(entity: Entity): DisplayEntity {
  const display: DisplayEntity = {
    id: entity.id,
    type: entity.type,
    x: entity.x,
    y: entity.y,
    templateId: (entity as { templateId?: string }).templateId ?? '',
  };

  if ('hp' in entity) {
    display.hp = entity.hp;
  }
  if ('maxHp' in entity) {
    display.maxHp = entity.maxHp;
  }
  if ('isAlive' in entity) {
    display.isAlive = entity.isAlive;
  }
  if ('level' in entity) {
    display.level = entity.level;
  }
  if ('statusEffects' in entity && Array.isArray(entity.statusEffects)) {
    display.statusEffects = entity.statusEffects.slice();
  }
  if (entity.type === 'door' && 'isOpen' in entity) {
    display.isOpen = entity.isOpen as boolean;
  }

  return display;
}

/** Преобразовать TileType в DisplayTile. */
function toDisplayTile(type: 'floor' | 'wall'): DisplayTile {
  return { type };
}

/** Собирает и сортирует оверлеи тайловых эффектов на клетке, включая их статусы. */
function getTileEffectOverlays(tileEffects: import('@simulation/core-types.ts').TileEffects): TileEffectOverlay[] {
  const overlays: TileEffectOverlay[] = [];
  for (const effect of Object.values(tileEffects)) {
    overlays.push({ type: effect.type, renderOrder: effect.renderOrder });
    for (const status of effect.statusEffects) {
      overlays.push({ type: status.type, renderOrder: status.renderOrder });
    }
  }
  // Сначала по возрастанию renderOrder, при равенстве — по типу для стабильности.
  overlays.sort((a, b) => {
    if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
    return a.type.localeCompare(b.type);
  });
  return overlays;
}

/** Создать копию DisplayMap. */
function cloneDisplayMap(map: DisplayMap): DisplayMap {
  return {
    width: map.width,
    height: map.height,
    tiles: map.tiles.map((row) =>
      row.map((tile) => ({
        ...tile,
        tileEffects: tile.tileEffects ? tile.tileEffects.map((overlay) => ({ ...overlay })) : undefined,
      })),
    ),
    visible: map.visible.map((row) => row.slice()),
    explored: map.explored.map((row) => row.slice()),
  };
}

/** Создать копию Map сущностей. */
function cloneEntities(entities: Map<string, DisplayEntity>): Map<string, DisplayEntity> {
  const copy = new Map<string, DisplayEntity>();
  for (const [id, entity] of entities) {
    copy.set(id, {
      ...entity,
      statusEffects: entity.statusEffects ? entity.statusEffects.slice() : undefined,
    });
  }
  return copy;
}

/** Создать копию DisplayState. */
export function cloneDisplayState(state: DisplayState): DisplayState {
  const entities = cloneEntities(state.entities);
  const player = entities.get(state.player.id) ?? state.player;
  return {
    map: cloneDisplayMap(state.map),
    entities,
    player,
    meta: { ...state.meta },
  };
}

/** Построить начальное DisplayState из GameState. */
export function buildDisplayState(state: GameState): DisplayState {
  const entities = new Map<string, DisplayEntity>();
  for (const entity of state.entities.values()) {
    entities.set(entity.id, toDisplayEntity(entity));
  }

  const player = entities.get(state.player.id) ?? toDisplayEntity(state.player);

  const tiles: DisplayTile[][] = state.map.tiles.map((row, y) =>
    row.map((tile, x) => {
      const displayTile = toDisplayTile(tile);
      const overlays = getTileEffectOverlays(state.tileEffects[y]?.[x] ?? {});
      if (overlays.length > 0) {
        displayTile.tileEffects = overlays;
      }
      return displayTile;
    }),
  );

  const map: DisplayMap = {
    width: state.map.width,
    height: state.map.height,
    tiles,
    visible: state.visible.map((row) => row.slice()),
    explored: state.explored.map((row) => row.slice()),
  };

  const meta: DisplayState['meta'] = {
    floor: state.floor,
    round: state.turn.round,
    turnSide: state.turn.activeSide,
    phase: state.phase,
  };

  return { map, entities, player, meta };
}

/** Обновить сущность в копии состояния и вернуть новый объект. */
function updateEntity(
  state: DisplayState,
  entityId: string,
  updater: (entity: DisplayEntity) => DisplayEntity,
): DisplayState {
  const entity = state.entities.get(entityId);
  if (!entity) return state;

  const entities = cloneEntities(state.entities);
  const updated = updater(entity);
  entities.set(entityId, updated);
  const player = state.player.id === entityId ? updated : state.player;

  return { ...state, entities, player };
}

/** Создать DisplayPatch для одного GameEvent.
 *
 *  Для событий FOG_UPDATED и TILE_EFFECT_* требуется `state`, чтобы построить
 *  корректный снимок видимых/исследованных клеток и оверлеев тайловых эффектов. */
export function createPatch(event: GameEvent, state: GameState): DisplayPatch {
  switch (event.type) {
    case 'ENTITY_MOVED':
      return {
        type: 'ENTITY_MOVED',
        entityId: event.entityId,
        from: event.from,
        to: event.to,
      };

    case 'ENTITY_DAMAGED':
      return {
        type: 'ENTITY_DAMAGED',
        entityId: event.targetId,
        damage: event.damage,
      };

    case 'ENTITY_HEALED':
      return {
        type: 'ENTITY_HEALED',
        entityId: event.entityId,
        amount: event.amount,
        newHp: event.newHp,
      };

    case 'ENTITY_DIED':
      return { type: 'ENTITY_DIED', entityId: event.entityId };

    case 'ENTITY_DISPLACED':
      return {
        type: 'ENTITY_DISPLACED',
        entityId: event.entityId,
        from: event.from,
        to: event.to,
      };

    case 'STATUS_APPLIED':
      return {
        type: 'STATUS_APPLIED',
        entityId: event.entityId,
        effect: event.effect,
      };

    case 'STATUS_REMOVED':
      return {
        type: 'STATUS_REMOVED',
        entityId: event.entityId,
        effectType: event.effectType,
      };

    case 'STATUS_BLOCKED':
      return { type: 'NO_OP' };

    case 'FOG_UPDATED': {
      const visible: Position[] = [];
      const explored: Position[] = [];
      if (state) {
        for (let y = 0; y < state.map.height; y++) {
          for (let x = 0; x < state.map.width; x++) {
            if (state.visible[y]![x]) visible.push({ x, y });
            if (state.explored[y]![x]) explored.push({ x, y });
          }
        }
      }
      return { type: 'FOG_UPDATED', visible, explored };
    }

    case 'DOOR_OPENED':
      return { type: 'DOOR_OPENED', position: event.position };

    case 'DOOR_CLOSED':
      return { type: 'DOOR_CLOSED', position: event.position };

    case 'ITEM_DROPPED': {
      const container: DisplayEntity = {
        id: event.containerId,
        type: 'floor_item_container',
        x: event.position.x,
        y: event.position.y,
        templateId: event.templateId,
        statusEffects: [],
      };
      return { type: 'ITEM_DROPPED', container };
    }

    case 'ITEM_PICKED_UP':
      return {
        type: 'ITEM_PICKED_UP',
        entityId: event.entityId,
        itemInstanceId: event.itemInstanceId,
      };

    case 'DEAD_ENTITIES_CLEANED':
      return {
        type: 'DEAD_ENTITIES_CLEANED',
        removed: event.removed,
      };

    case 'FLOOR_CHANGED':
      return { type: 'FLOOR_CHANGED', floor: event.to };

    case 'MAP_CHANGED':
    case 'ENTITIES_REPLACED':
      return { type: 'NO_OP' };

    case 'PLAYER_DIED':
      return { type: 'PLAYER_DIED' };

    case 'PLAYER_LEVELED_UP':
      return { type: 'PLAYER_LEVELED_UP', level: event.newLevel };

    case 'TURN_BEGAN':
      return {
        type: 'TURN_BEGAN',
        turnSide: event.side,
        round: event.round,
      };

    case 'TILE_EFFECT_CHANGED':
      return {
        type: 'TILE_EFFECT_CHANGED',
        effectType: event.effectType,
        position: event.position,
        overlays: getTileEffectOverlays(state.tileEffects[event.position.y]?.[event.position.x] ?? {}),
      };

    case 'TILE_EFFECT_REMOVED':
      return {
        type: 'TILE_EFFECT_REMOVED',
        effectType: event.effectType,
        position: event.position,
        overlays: getTileEffectOverlays(state.tileEffects[event.position.y]?.[event.position.x] ?? {}),
      };

    case 'TILE_EFFECT_STATUS_APPLIED':
      return {
        type: 'TILE_EFFECT_CHANGED',
        effectType: event.effectType,
        position: event.position,
        overlays: getTileEffectOverlays(state.tileEffects[event.position.y]?.[event.position.x] ?? {}),
      };

    case 'TILE_EFFECT_STATUS_REMOVED':
      return {
        type: 'TILE_EFFECT_CHANGED',
        effectType: event.effectType,
        position: event.position,
        overlays: getTileEffectOverlays(state.tileEffects[event.position.y]?.[event.position.x] ?? {}),
      };

    case 'TILE_EFFECT_STATUS_TICKED':
    case 'TILE_EFFECT_TICKED':
      return { type: 'NO_OP' };

    case 'RESOURCE_CONSUMED':
    case 'AP_RESTORED':
    case 'COOLDOWN_SET':
    case 'COOLDOWN_TICKED':
    case 'ITEM_EQUIPPED':
    case 'ITEM_UNEQUIPPED':
    case 'ABILITY_GRANTED':
    case 'ABILITY_REVOKED':
    case 'ITEM_USED':
      return { type: 'NO_OP' };

    default:
      return { type: 'NO_OP' };
  }
}

/** Применить патч к DisplayState и вернуть новое состояние. */
export function applyPatch(state: DisplayState, patch: DisplayPatch): DisplayState {
  switch (patch.type) {
    case 'NO_OP':
      return cloneDisplayState(state);

    case 'ENTITY_MOVED':
    case 'ENTITY_DISPLACED':
      return updateEntity(state, patch.entityId, (entity) => ({
        ...entity,
        x: patch.to.x,
        y: patch.to.y,
      }));

    case 'ENTITY_DAMAGED': {
      const entity = state.entities.get(patch.entityId);
      if (!entity || entity.hp === undefined) return cloneDisplayState(state);
      const newHp = Math.max(0, entity.hp - patch.damage);
      return updateEntity(state, patch.entityId, (e) => ({ ...e, hp: newHp }));
    }

    case 'ENTITY_HEALED': {
      const entity = state.entities.get(patch.entityId);
      if (!entity) return cloneDisplayState(state);
      const maxHp = entity.maxHp ?? patch.newHp;
      const newHp = Math.min(maxHp, patch.newHp);
      return updateEntity(state, patch.entityId, (e) => ({ ...e, hp: newHp }));
    }

    case 'ENTITY_DIED':
      return updateEntity(state, patch.entityId, (entity) => ({
        ...entity,
        isAlive: false,
      }));

    case 'STATUS_APPLIED': {
      const entity = state.entities.get(patch.entityId);
      if (!entity) return cloneDisplayState(state);
      const effects = entity.statusEffects ? entity.statusEffects.slice() : [];
      const index = effects.findIndex((e) => e.type === patch.effect.type);
      if (index >= 0) {
        effects[index] = patch.effect;
      } else {
        effects.push(patch.effect);
      }
      return updateEntity(state, patch.entityId, (e) => ({ ...e, statusEffects: effects }));
    }

    case 'STATUS_REMOVED': {
      const entity = state.entities.get(patch.entityId);
      if (!entity) return cloneDisplayState(state);
      const effects = entity.statusEffects?.filter((e) => e.type !== patch.effectType) ?? [];
      return updateEntity(state, patch.entityId, (e) => ({ ...e, statusEffects: effects }));
    }

    case 'FOG_UPDATED': {
      const newMap = cloneDisplayMap(state.map);
      // Заменяем сетки видимости/исследованности полными снимками из Simulation.
      for (let y = 0; y < newMap.height; y++) {
        for (let x = 0; x < newMap.width; x++) {
          newMap.visible[y]![x] = false;
          newMap.explored[y]![x] = false;
        }
      }
      for (const pos of patch.visible) {
        if (pos.y >= 0 && pos.y < newMap.height && pos.x >= 0 && pos.x < newMap.width) {
          newMap.visible[pos.y]![pos.x] = true;
        }
      }
      for (const pos of patch.explored) {
        if (pos.y >= 0 && pos.y < newMap.height && pos.x >= 0 && pos.x < newMap.width) {
          newMap.explored[pos.y]![pos.x] = true;
        }
      }
      return { ...state, map: newMap };
    }

    case 'DOOR_OPENED':
    case 'DOOR_CLOSED': {
      const isOpen = patch.type === 'DOOR_OPENED';
      const newEntities = cloneEntities(state.entities);
      let player = state.player;
      for (const [id, entity] of newEntities) {
        if (entity.type === 'door' && entity.x === patch.position.x && entity.y === patch.position.y) {
          const updated = { ...entity, isOpen };
          newEntities.set(id, updated);
          if (player.id === id) player = updated;
        }
      }
      return { ...state, entities: newEntities, player };
    }

    case 'ITEM_DROPPED': {
      const newState = cloneDisplayState(state);
      newState.entities.set(patch.container.id, patch.container);
      return newState;
    }

    case 'ITEM_PICKED_UP': {
      const picker = state.entities.get(patch.entityId);
      const newEntities = cloneEntities(state.entities);
      let removed = false;
      for (const [id, entity] of newEntities) {
        if (entity.type === 'floor_item_container') {
          const containerItem = (entity as unknown as { item?: { instanceId?: string } }).item;
          if (containerItem?.instanceId === patch.itemInstanceId) {
            newEntities.delete(id);
            removed = true;
          }
        }
      }
      if (!removed && picker) {
        for (const [id, entity] of newEntities) {
          if (entity.type === 'floor_item_container' && entity.x === picker.x && entity.y === picker.y) {
            newEntities.delete(id);
          }
        }
      }
      const player = newEntities.get(state.player.id) ?? state.player;
      return { ...state, entities: newEntities, player };
    }

    case 'DEAD_ENTITIES_CLEANED': {
      const newEntities = cloneEntities(state.entities);
      for (const entry of patch.removed) {
        newEntities.delete(entry.entityId);
      }
      const player = newEntities.get(state.player.id) ?? state.player;
      return { ...state, entities: newEntities, player };
    }

    case 'FLOOR_CHANGED': {
      return { ...state, meta: { ...state.meta, floor: patch.floor } };
    }

    case 'PLAYER_DIED': {
      const newState = updateEntity(state, state.player.id, (entity) => ({
        ...entity,
        isAlive: false,
      }));
      return { ...newState, meta: { ...newState.meta, phase: 'dead' } };
    }

    case 'PLAYER_LEVELED_UP': {
      return updateEntity(state, state.player.id, (entity) => ({
        ...entity,
        level: patch.level,
      }));
    }

    case 'TURN_BEGAN': {
      return {
        ...state,
        meta: {
          ...state.meta,
          turnSide: patch.turnSide,
          round: patch.round,
        },
      };
    }

    case 'TILE_EFFECT_CHANGED':
    case 'TILE_EFFECT_REMOVED': {
      const newMap = cloneDisplayMap(state.map);
      const { x, y } = patch.position;
      if (y >= 0 && y < newMap.height && x >= 0 && x < newMap.width) {
        const tile = newMap.tiles[y]![x];
        if (tile) {
          tile.tileEffects = patch.overlays;
        }
      }
      return { ...state, map: newMap };
    }

    default:
      return cloneDisplayState(state);
  }
}

/** Применить все патчи плана к DisplayState и вернуть новое состояние.
 *
 * Используется в GameSession после dispatch/step, чтобы синхронизировать
 * DisplayState с результатом Simulation, пока UI не берёт на себя
 * пошаговое применение патчей по завершении анимаций. */
export function applyPatches(
  state: DisplayState,
  plan: PresentationNode[],
): DisplayState {
  let next = state;
  for (const node of plan) {
    next = applyPatch(next, node.patch);
  }
  return next;
}
