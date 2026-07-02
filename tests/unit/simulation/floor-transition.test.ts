import {describe, expect, it, beforeEach, afterEach} from "vitest";
import {makeGameState, makePlayer} from "../../fixtures/gameState.ts";
import {descendAction, ascendAction} from "@simulation/systems/actions/floor-transition-action";
import {stairsTransitionReaction} from "@simulation/systems/world-reactions/stairs-reaction";
import type {GameState, StairsEntity, EntityMovedEvent, GameEvent} from "@simulation/types.ts";
import type {DoorTemplate} from "@content/schemas";
import {initRegistry, resetRegistry} from "@content/registry";
import {ExecutionBuilder} from "@simulation/systems/actions/types";

/**
 * Хелпер: создаёт сущность-лестницу.
 */
function makeStairs(overrides: Partial<StairsEntity> & { templateId: 'stairs_down' | 'stairs_up'; x: number; y: number }): StairsEntity {
  return {
    id: `stairs_${overrides.templateId}_${overrides.x}_${overrides.y}`,
    type: 'stairs',
    blocksMovement: false,
    interactionKind: 'stairs',
    displayName: 'Лестница',
    ...overrides,
  };
}

/**
 * Хелпер: добавляет сущность в состояние.
 */
function addEntity(state: GameState, entity: import('@simulation/types').Entity): GameState {
  state.entities.set(entity.id, entity);
  return state;
}

/**
 * Хелпер: извлекает типы событий из дочерних узлов.
 */
function childEventTypes(node: { children: { event: GameEvent }[] }): string[] {
  return node.children.map(child => child.event.type);
}

describe('stairsTransitionReaction — обнаружение лестницы', () => {
  it('порождает STAIR_EXIT_TRIGGERED при наступании на stairs_down', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs({ templateId: 'stairs_down', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 1 }), stairs);

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'MOVE', entityId: 'player', dx: 0, dy: 0 },
    });
    const moveEvent: EntityMovedEvent = {
      type: 'ENTITY_MOVED', movementType: 'walk',
      entityId: 'player',
      from: { x: 5, y: 5 },
      to: { x: 5, y: 5 },
    };
    const moveNode = builder.addChild(builder.root, moveEvent);

    const intents = stairsTransitionReaction(state, moveEvent, builder, moveNode);

    expect(state.floor).toBe(1);
    expect(intents).toEqual([{ type: 'TRIGGER_STAIR_EXIT', direction: 'down' }]);
    expect(moveNode.children.length).toBe(0);
  });

  it('не срабатывает, если на клетке нет лестницы', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'MOVE', entityId: 'player', dx: 0, dy: 0 },
    });
    const moveEvent: EntityMovedEvent = {
      type: 'ENTITY_MOVED', movementType: 'walk',
      entityId: 'player',
      from: { x: 4, y: 5 },
      to: { x: 5, y: 5 },
    };
    const moveNode = builder.addChild(builder.root, moveEvent);

    const intents = stairsTransitionReaction(state, moveEvent, builder, moveNode);

    expect(intents).toEqual([]);
    expect(moveNode.children.length).toBe(0);
  });

  it('не срабатывает на перемещение врага', () => {
    const stairs = makeStairs({ templateId: 'stairs_down', x: 3, y: 3 });
    const state = addEntity(makeGameState({ floor: 1 }), stairs);

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'MOVE', entityId: 'enemy_1', dx: 0, dy: 0 },
    });
    const moveEvent: EntityMovedEvent = {
      type: 'ENTITY_MOVED', movementType: 'walk',
      entityId: 'enemy_1',
      from: { x: 2, y: 3 },
      to: { x: 3, y: 3 },
    };
    const moveNode = builder.addChild(builder.root, moveEvent);

    const intents = stairsTransitionReaction(state, moveEvent, builder, moveNode);

    expect(intents).toEqual([]);
    expect(moveNode.children.length).toBe(0);
  });

  it('не срабатывает на stairs_up на первом этаже', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs({ templateId: 'stairs_up', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 1 }), stairs);

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'MOVE', entityId: 'player', dx: 0, dy: 0 },
    });
    const moveEvent: EntityMovedEvent = {
      type: 'ENTITY_MOVED', movementType: 'walk',
      entityId: 'player',
      from: { x: 5, y: 5 },
      to: { x: 5, y: 5 },
    };
    const moveNode = builder.addChild(builder.root, moveEvent);

    const intents = stairsTransitionReaction(state, moveEvent, builder, moveNode);

    expect(intents).toEqual([]);
    expect(moveNode.children.length).toBe(0);
  });
});

describe('descendAction / ascendAction — валидация', () => {
  it('descend: разрешает спуск на лестнице вниз', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs({ templateId: 'stairs_down', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 1 }), stairs);

    const result = descendAction.validate(state, { type: 'DESCEND', entityId: player.id });
    expect(result.ok).toBe(true);
  });

  it('descend: отказывает без лестницы', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });

    const result = descendAction.validate(state, { type: 'DESCEND', entityId: player.id });
    expect(result.ok).toBe(false);
  });

  it('ascend: разрешает подъём на лестнице вверх', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs({ templateId: 'stairs_up', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 2 }), stairs);

    const result = ascendAction.validate(state, { type: 'ASCEND', entityId: player.id });
    expect(result.ok).toBe(true);
  });

  it('ascend: отказывает на первом этаже', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs({ templateId: 'stairs_up', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 1 }), stairs);

    const result = ascendAction.validate(state, { type: 'ASCEND', entityId: player.id });
    expect(result.ok).toBe(false);
  });
});

describe('descendAction.execute — переход на новый этаж', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map([
        ['wooden_door', {
          id: 'wooden_door',
          maxHp: 30,
          armor: 2,
        } as DoorTemplate],
      ]),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('генерирует новый этаж и строит дерево событий', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairsDown = makeStairs({ templateId: 'stairs_down', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 1 }), stairsDown);
    const oldMap = state.map;

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'DESCEND', entityId: 'player' },
    });

    descendAction.execute(state, { type: 'DESCEND', entityId: 'player' }, [], builder, builder.root);

    expect(state.floor).toBe(2);
    expect(state.map).not.toBe(oldMap);
    expect(state.entities.has('player')).toBe(true);
    expect(state.player.ap).toBe(state.player.maxAp);
    expect(state.turn.activeSide).toBe('PLAYER');
    expect(state.turn.round).toBe(1);

    const floorNode = builder.root.children[0]!;
    expect(floorNode.event.type).toBe('FLOOR_CHANGED');

    const types = childEventTypes(floorNode);
    expect(types).toContain('MAP_CHANGED');
    expect(types).toContain('ENTITIES_REPLACED');
    expect(types).toContain('ENTITY_MOVED');
    expect(types).toContain('TURN_BEGAN');
    expect(types).toContain('AP_RESTORED');
  });

  it('сохраняет текущий этаж в снапшот перед спуском', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairsDown = makeStairs({ templateId: 'stairs_down', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 1 }), stairsDown);
    state.explored[5]![5] = true;

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'DESCEND', entityId: 'player' },
    });

    descendAction.execute(state, { type: 'DESCEND', entityId: 'player' }, [], builder, builder.root);

    expect(state.floorSnapshots[0]).toBeDefined();
    expect(state.floorSnapshots[0]!.floor).toBe(1);
    expect(state.floorSnapshots[0]!.explored[5]![5]).toBe(true);
  });

  it('восстанавливает снапшот при возвращении наверх', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairsDown = makeStairs({ templateId: 'stairs_down', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 1 }), stairsDown);
    const originalMap = state.map;
    state.explored[5]![5] = true;

    const descendBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'DESCEND', entityId: 'player' },
    });
    descendAction.execute(state, { type: 'DESCEND', entityId: 'player' }, [], descendBuilder, descendBuilder.root);
    expect(state.floor).toBe(2);

    const stairsUp = Array.from(state.entities.values()).find(
      (e): e is StairsEntity => e.type === 'stairs' && e.templateId === 'stairs_up',
    );
    expect(stairsUp).toBeDefined();
    state.player.x = stairsUp!.x;
    state.player.y = stairsUp!.y;

    const ascendBuilder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'ASCEND', entityId: 'player' },
    });
    ascendAction.execute(state, { type: 'ASCEND', entityId: 'player' }, [], ascendBuilder, ascendBuilder.root);

    expect(state.floor).toBe(1);
    expect(state.map).toBe(originalMap);
    expect(state.explored[5]![5]).toBe(true);
  });

  it('позиционирует игрока у лестницы при переходе', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairsDown = makeStairs({ templateId: 'stairs_down', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 1 }), stairsDown);

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'DESCEND', entityId: 'player' },
    });

    descendAction.execute(state, { type: 'DESCEND', entityId: 'player' }, [], builder, builder.root);

    const floor2StairsUp = Array.from(state.entities.values()).find(
      (e): e is StairsEntity => e.type === 'stairs' && e.templateId === 'stairs_up',
    );
    expect(floor2StairsUp).toBeDefined();
    expect(state.player.x).toBe(floor2StairsUp!.x);
    expect(state.player.y).toBe(floor2StairsUp!.y);
  });

  it('не теряет игрока при переходе', () => {
    const player = makePlayer({ x: 5, y: 5, hp: 77 });
    const stairsDown = makeStairs({ templateId: 'stairs_down', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 1 }), stairsDown);

    const builder = new ExecutionBuilder({
      type: 'ACTION_APPLIED',
      action: { type: 'DESCEND', entityId: 'player' },
    });

    descendAction.execute(state, { type: 'DESCEND', entityId: 'player' }, [], builder, builder.root);

    expect(state.player.hp).toBe(77);
    expect(state.entities.get('player')).toBe(state.player);
  });
});
