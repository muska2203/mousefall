import {describe, expect, it, beforeEach, afterEach} from "vitest";
import {makeGameState, makePlayer} from "../../fixtures/gameState.ts";
import {performFloorTransition} from "@simulation/systems/actions/floor-transition-logic";
import {descendAction, ascendAction} from "@simulation/systems/actions/floor-transition-action";
import {stairsTransitionReaction} from "@simulation/systems/world-reactions/stairs-reaction";
import type {GameState, StairsEntity, EntityMovedEvent} from "@simulation/types.ts";
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

    // Состояние НЕ должно измениться
    expect(state.floor).toBe(1);
    // Реакция должна вернуть интент, порождающий событие-запрос
    expect(intents).toEqual([{ type: 'TRIGGER_STAIR_EXIT', direction: 'down' }]);
    // Дерево не мутируется напрямую реакцией
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

describe('performFloorTransition — спуск и подъём', () => {
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

  it('генерирует новый этаж при спуске', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    const oldMap = state.map;

    performFloorTransition(state, 'down');

    expect(state.floor).toBe(2);
    expect(state.map).not.toBe(oldMap);
    expect(state.entities.has('player')).toBe(true);
    expect(state.player.ap).toBe(state.player.maxAp);
    expect(state.turn.activeSide).toBe('PLAYER');
  });

  it('сохраняет текущий этаж в снапшот перед спуском', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    state.explored[5]![5] = true;

    performFloorTransition(state, 'down');

    expect(state.floorSnapshots[0]).toBeDefined();
    expect(state.floorSnapshots[0]!.floor).toBe(1);
    expect(state.floorSnapshots[0]!.explored[5]![5]).toBe(true);
  });

  it('восстанавливает снапшот при возвращении наверх', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({ player, floor: 1 });
    const originalMap = state.map;
    state.explored[5]![5] = true;

    performFloorTransition(state, 'down');
    expect(state.floor).toBe(2);

    performFloorTransition(state, 'up');
    expect(state.floor).toBe(1);

    expect(state.map).toBe(originalMap);
    expect(state.explored[5]![5]).toBe(true);
  });

  it('позиционирует игрока у лестницы при переходе', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairsDown = makeStairs({ templateId: 'stairs_down', x: 5, y: 5 });
    const state = addEntity(makeGameState({ player, floor: 1 }), stairsDown);

    performFloorTransition(state, 'down');
    const floor2StairsUp = Array.from(state.entities.values()).find(
      (e): e is StairsEntity => e.type === 'stairs' && e.templateId === 'stairs_up',
    );
    expect(floor2StairsUp).toBeDefined();
    expect(state.player.x).toBe(floor2StairsUp!.x);
    expect(state.player.y).toBe(floor2StairsUp!.y);

    performFloorTransition(state, 'up');
    const floor1StairsDown = Array.from(state.entities.values()).find(
      (e): e is StairsEntity => e.type === 'stairs' && e.templateId === 'stairs_down',
    );
    expect(floor1StairsDown).toBeDefined();
    expect(state.player.x).toBe(floor1StairsDown!.x);
    expect(state.player.y).toBe(floor1StairsDown!.y);
  });

  it('не теряет игрока при переходе', () => {
    const player = makePlayer({ x: 5, y: 5, hp: 77 });
    const state = makeGameState({ player, floor: 1 });

    performFloorTransition(state, 'down');

    expect(state.player.hp).toBe(77);
    expect(state.entities.get('player')).toBe(state.player);
  });
});
