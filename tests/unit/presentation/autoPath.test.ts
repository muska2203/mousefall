import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import '@i18n/config';
import { GameSession } from '../../../src/presentation/gameSession';
import { AutoPathController, type AutoPathQueries } from '../../../src/presentation/autoPathController';
import { findPathTowards } from '../../../src/presentation/pathfinding';
import { GameSimulation } from '../../../src/simulation/simulation';
import { drainAnimations } from '../../helpers/simulation';
import { makeGameState, makePlayer, makeEnemy, makeDoor, makeFloorItemContainer, makeStairs } from '../../fixtures/gameState';
import type { Entity, EnemyEntity, DoorEntity, Position } from '../../../src/simulation/types';
import { initRegistry, resetRegistry } from '../../../src/content/registry';

function initEmptyRegistry() {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
    statuses: new Map(),
});
}

function moveTarget(x: number, y: number) {
  return { position: { x, y }, kind: 'move' as const, entityId: null };
}

function makeQueries(state: ReturnType<typeof makeGameState>): AutoPathQueries {
  const simulation = GameSimulation.loadSavedGame(state, false);
  const isTileWalkable = (pos: Position) => simulation.isTileWalkableForPlayer(pos);
  const isTilePassable = (pos: Position): boolean => {
    if (isTileWalkable(pos)) return true;
    const blockers = simulation.findEntitiesAt(pos).filter((e) => e.blocksMovement);
    if (blockers.length !== 1) return false;
    const door = blockers[0];
    if (!door) return false;
    return door.type === 'door' && door.isAlive !== false && !door.isOpen;
  };
  return {
    isTileWalkable,
    isTilePassable,
    findPathTowards: (start, target) => findPathTowards(start, target, isTileWalkable, isTilePassable),
    findEntityAt: (pos, filter) => simulation.findEntityAt(pos, filter),
    findEntitiesAt: (pos, filter) => simulation.findEntitiesAt(pos, filter),
  };
}

function setupController(state: ReturnType<typeof makeGameState>) {
  return {
    controller: new AutoPathController(),
    queries: makeQueries(state),
  };
}

describe('Simulation pathfinding', () => {
  beforeEach(initEmptyRegistry);
  afterEach(resetRegistry);

  it('finds path to an explored floor tile', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    const simulation = GameSimulation.loadSavedGame(state, false);

    const path = simulation.findPathForPlayer({ x: 5, y: 5 }, { x: 5, y: 7 });
    expect(path).not.toBeNull();

    expect(path).toHaveLength(2);
    expect(path).toEqual([{ x: 5, y: 6 }, { x: 5, y: 7 }]);
  });

  it('treats visible enemies as obstacles', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.visible[6]![5] = true;
    state.explored[6]![5] = true;
    const simulation = GameSimulation.loadSavedGame(state, false);

    const path = simulation.findPathForPlayer({ x: 5, y: 5 }, { x: 5, y: 6 });

    expect(path).toBeNull();
  });

  it('ignores invisible enemies when building path', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[6]![5] = true;
    const simulation = GameSimulation.loadSavedGame(state, false);

    const path = simulation.findPathForPlayer({ x: 5, y: 5 }, { x: 5, y: 6 });

    expect(path).not.toBeNull();
    expect(path).toEqual([{ x: 5, y: 6 }]);
  });

  it('always treats walls as obstacles', () => {
    const state = makeGameState();
    state.map.tiles[6]![5] = 'wall';
    state.explored[6]![5] = true;
    const simulation = GameSimulation.loadSavedGame(state, false);

    const path = simulation.findPathForPlayer({ x: 5, y: 5 }, { x: 5, y: 6 });

    expect(path).toBeNull();
  });

  it('builds path towards a visible enemy tile', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.visible[6]![5] = true;
    state.explored[6]![5] = true;
    const queries = makeQueries(state);

    const path = queries.findPathTowards({ x: 5, y: 5 }, { position: { x: 5, y: 6 }, kind: 'enemy', entityId: enemy.id });

    expect(path).toEqual([{ x: 5, y: 6 }]);
  });

  it('builds path towards a closed door tile', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    state.explored[6]![5] = true;
    const queries = makeQueries(state);

    const path = queries.findPathTowards({ x: 5, y: 5 }, { position: { x: 5, y: 6 }, kind: 'door', entityId: door.id });

    expect(path).toEqual([{ x: 5, y: 6 }]);
  });

  it('does not build path to a move target occupied by a visible enemy', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.visible[6]![5] = true;
    state.explored[6]![5] = true;
    const queries = makeQueries(state);

    const path = queries.findPathTowards({ x: 5, y: 5 }, { position: { x: 5, y: 6 }, kind: 'move', entityId: null });

    expect(path).toBeNull();
  });
});

describe('AutoPathController', () => {
  beforeEach(initEmptyRegistry);
  afterEach(resetRegistry);

  it('builds preview path on hover over explored tile', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);

    controller.hover(moveTarget(5, 6), state, queries);

    expect(controller.isActive()).toBe(true);
    expect(controller.getPath()).toEqual([{ x: 5, y: 6 }]);
    expect(controller.getTarget()).toEqual(moveTarget(5, 6));
    expect(controller.isCommitted()).toBe(false);
  });

  it('does not build path over unexplored tile', () => {
    const state = makeGameState();
    const { controller, queries } = setupController(state);

    controller.hover(moveTarget(5, 6), state, queries);

    expect(controller.isActive()).toBe(false);
  });

  it('clears preview on hover null', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 6), state, queries);

    controller.hover(null, state, queries);

    expect(controller.isActive()).toBe(false);
  });

  it('commits active preview path', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 6), state, queries);

    expect(controller.commit()).toBe(true);
    expect(controller.isCommitted()).toBe(true);
  });

  it('commit returns false and cancels when there is no path', () => {
    const state = makeGameState();
    // Целевая клетка — стена, пути нет.
    state.map.tiles[6]![5] = 'wall';
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 6), state, queries);

    expect(controller.commit()).toBe(false);
    expect(controller.isActive()).toBe(false);
  });

  it('step returns MOVE action to the first tile', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 7), state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'MOVE',
        entityId: state.player.id,
        dx: 0,
        dy: 1,
      },
    });
  });

  it('step rebuilds path from new player position', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 7), state, queries);
    controller.commit();

    // Игрок уже сделал первый шаг вручную
    state.player.y = 6;

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'MOVE',
        entityId: state.player.id,
        dx: 0,
        dy: 1,
      },
    });
    expect(controller.getPath()).toEqual([{ x: 5, y: 7 }]);
  });

  it('step cancels path when target becomes blocked by visible enemy for move target', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);
    // Пока враг невидим, путь к его клетке строится.
    controller.hover(moveTarget(5, 6), state, queries);
    controller.commit();

    // Враг стал видимым — целевая клетка больше непроходима для move-цели.
    state.visible[6]![5] = true;

    const result = controller.step(state, queries);

    expect(result).toEqual({ kind: 'cancelled' });
    expect(controller.isActive()).toBe(false);
  });

  it('hover does not change committed path', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    state.explored[6]![6] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 6), state, queries);
    controller.commit();

    controller.hover(moveTarget(6, 6), state, queries);

    expect(controller.getTarget()).toEqual(moveTarget(5, 6));
    expect(controller.isCommitted()).toBe(true);
  });

  it('cancel resets everything', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 6), state, queries);
    controller.commit();

    controller.cancel();

    expect(controller.isActive()).toBe(false);
    expect(controller.isCommitted()).toBe(false);
    expect(controller.getPath()).toBeNull();
  });

  it('step returns ATTACK when adjacent to enemy target and cancels path', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[5]![6] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 6, y: 5 }, kind: 'enemy', entityId: enemy.id }, state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'ATTACK',
        entityId: state.player.id,
        dx: 1,
        dy: 0,
      },
    });
    expect(controller.isActive()).toBe(false);
    expect(controller.isCommitted()).toBe(false);
  });

  it('step tracks moving enemy target', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[5]![6] = true;
    state.explored[5]![7] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 6, y: 5 }, kind: 'enemy', entityId: enemy.id }, state, queries);
    controller.commit();

    // Враг отступил на две клетки — путь перестроился, но пока не впритык.
    enemy.x = 7;

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'MOVE',
        entityId: state.player.id,
        dx: 1,
        dy: 0,
      },
    });
    expect(controller.getTarget()?.position).toEqual({ x: 7, y: 5 });
  });

  it('step tracks enemy that moves adjacent to player and attacks once', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[5]![6] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 6, y: 5 }, kind: 'enemy', entityId: enemy.id }, state, queries);
    controller.commit();

    // Враг обошёл игрока сбоку и оказался впритык с другой стороны.
    enemy.x = 4;

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'ATTACK',
        entityId: state.player.id,
        dx: -1,
        dy: 0,
      },
    });
    // Автопуть завершается после первой атаки.
    expect(controller.isActive()).toBe(false);
    expect(controller.isCommitted()).toBe(false);
  });

  it('step cancels when enemy target dies', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[5]![6] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 6, y: 5 }, kind: 'enemy', entityId: enemy.id }, state, queries);
    controller.commit();

    enemy.isAlive = false;

    const result = controller.step(state, queries);

    expect(result).toEqual({ kind: 'cancelled' });
    expect(controller.isActive()).toBe(false);
  });

  it('step returns INTERACT when adjacent to closed door target and cancels path', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 5, y: 6 }, kind: 'door', entityId: door.id }, state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'INTERACT',
        entityId: state.player.id,
        targetId: door.id,
      },
    });
    expect(controller.isActive()).toBe(false);
    expect(controller.isCommitted()).toBe(false);
  });

  it('step returns MOVE onto open door target and then cancels', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6, isOpen: true, blocksMovement: false });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 5, y: 6 }, kind: 'door', entityId: door.id }, state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'MOVE',
        entityId: state.player.id,
        dx: 0,
        dy: 1,
      },
    });
    expect(controller.isActive()).toBe(false);
    expect(controller.isCommitted()).toBe(false);
  });

  it('step returns INTERACT when standing on item target', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const item = makeFloorItemContainer({ x: 5, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [item.id, item]]),
    });
    state.explored[5]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 5, y: 5 }, kind: 'interactable', entityId: item.id }, state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'INTERACT',
        entityId: state.player.id,
        targetId: item.id,
      },
    });
    expect(controller.isActive()).toBe(false);
  });

  it('step returns INTERACT when standing on downstairs target', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [stairs.id, stairs]]),
    });
    state.explored[5]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 5, y: 5 }, kind: 'interactable', entityId: stairs.id }, state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'INTERACT',
        entityId: state.player.id,
        targetId: stairs.id,
      },
    });
    expect(controller.isActive()).toBe(false);
  });

  it('step moves onto adjacent item tile before pickup', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const item = makeFloorItemContainer({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [item.id, item]]),
    });
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 5, y: 6 }, kind: 'interactable', entityId: item.id }, state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'MOVE',
        entityId: state.player.id,
        dx: 0,
        dy: 1,
      },
    });
    expect(controller.isActive()).toBe(true);
    expect(controller.isCommitted()).toBe(true);
  });

  it('step picks up item after moving onto its tile', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const item = makeFloorItemContainer({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [item.id, item]]),
    });
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 5, y: 6 }, kind: 'interactable', entityId: item.id }, state, queries);
    controller.commit();

    // Сначала игрок перемещается на клетку предмета.
    controller.step(state, queries);
    state.player.y = 6;

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'INTERACT',
        entityId: state.player.id,
        targetId: item.id,
      },
    });
    expect(controller.isActive()).toBe(false);
  });

  it('step moves onto adjacent downstairs tile before descend', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const stairs = makeStairs('stairs_down', { x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [stairs.id, stairs]]),
    });
    state.explored[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 5, y: 6 }, kind: 'interactable', entityId: stairs.id }, state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'MOVE',
        entityId: state.player.id,
        dx: 0,
        dy: 1,
      },
    });
    expect(controller.isActive()).toBe(true);
  });

  it('cancels path when a new enemy becomes visible after a step', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[5]![6] = true;
    state.explored[5]![7] = true;
    state.explored[6]![6] = true;
    // Враг пока не в поле зрения.
    state.visible[6]![6] = false;

    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 7, y: 5 }, kind: 'move', entityId: null }, state, queries);
    controller.commit();

    // Первый шаг: видимых врагов нет, идём дальше.
    const result1 = controller.step(state, queries);
    expect(result1.kind).toBe('action');
    if (result1.kind === 'action') {
      expect(result1.action.type).toBe('MOVE');
    }

    // Игрок сделал шаг, и враг оказался в поле зрения.
    state.player.x = 6;
    state.player.y = 5;
    state.visible[6]![6] = true;

    const result2 = controller.step(state, queries);
    expect(result2).toEqual({ kind: 'cancelled', reason: 'new_enemy' });
    expect(controller.isActive()).toBe(false);
    expect(controller.isCommitted()).toBe(false);
  });
});

describe('AutoPathController door passage', () => {
  beforeEach(initEmptyRegistry);
  afterEach(resetRegistry);

  it('builds path through a closed door to a target beyond', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.visible[6]![5] = true;
    const queries = makeQueries(state);

    const path = queries.findPathTowards({ x: 5, y: 5 }, moveTarget(5, 7));

    expect(path).toEqual([{ x: 5, y: 6 }, { x: 5, y: 7 }]);
  });

  it('step opens a closed door on the path and keeps the path committed', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.visible[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 7), state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'INTERACT',
        entityId: state.player.id,
        targetId: door.id,
      },
    });
    expect(controller.isActive()).toBe(true);
    expect(controller.isCommitted()).toBe(true);
  });

  it('step continues movement after the door is opened', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.visible[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 7), state, queries);
    controller.commit();

    // Первый шаг открывает дверь.
    controller.step(state, queries);
    // Дверь открыта.
    door.isOpen = true;
    door.blocksMovement = false;

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'MOVE',
        entityId: state.player.id,
        dx: 0,
        dy: 1,
      },
    });
    expect(controller.isActive()).toBe(true);
    expect(controller.isCommitted()).toBe(true);
  });

  it('moves through an already open door on the path', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6, isOpen: true, blocksMovement: false });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 7), state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'MOVE',
        entityId: state.player.id,
        dx: 0,
        dy: 1,
      },
    });
    expect(controller.isActive()).toBe(true);
    expect(controller.isCommitted()).toBe(true);
  });

  it('avoids door tile when an enemy stands on it', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6 });
    const enemy = makeEnemy({ x: 5, y: 6, id: 'enemy_on_door' });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door], [enemy.id, enemy]]),
    });
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.visible[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover(moveTarget(5, 7), state, queries);

    // Автопуть должен обойти клетку с врагом и дверью, а не пытаться пройти через неё.
    expect(controller.commit()).toBe(true);
    const path = controller.getPath();
    expect(path).not.toBeNull();
    expect(path!.some((p) => p.x === 5 && p.y === 6)).toBe(false);
  });
});

describe('GameSession auto-path integration', () => {
  beforeEach(initEmptyRegistry);
  afterEach(resetRegistry);

  it('hover sets highlightedPath in render input', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    const session = new GameSession();
    session.loadGame(state);

    session.setFieldHover({ x: 5, y: 6 });

    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPath).toEqual([{ x: 5, y: 6 }]);
    expect(vm.renderInput?.highlightedPathCommitted).toBe(false);
    expect(vm.renderInput?.highlightedPathTargetKind).toBe('move');
  });

  it('hover on visible enemy sets enemy target kind', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[5]![6] = true;
    state.visible[5]![6] = true;
    const session = new GameSession();
    session.loadGame(state);

    session.setFieldHover({ x: 6, y: 5 });

    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPath).toEqual([{ x: 6, y: 5 }]);
    expect(vm.renderInput?.highlightedPathTargetKind).toBe('move'); // preview всегда move/белый
  });

  it('click commits path and dispatches first MOVE', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    state.player.ap = 1;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 5, y: 6 });

    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPathCommitted).toBe(true);
    expect(vm.renderInput?.state.player.y).toBe(6);
  });

  it('click on visible enemy commits, dispatches ATTACK and cancels path', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[5]![6] = true;
    state.visible[5]![6] = true;
    state.player.ap = 2;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 6, y: 5 });

    const vm = session.getViewModel();
    // Автопуть завершается после первой атаки.
    expect(vm.renderInput?.highlightedPathCommitted).toBe(false);
    expect(vm.renderInput?.highlightedPathTargetKind).toBe('none');
    // Враг получил урон — hp меньше maxHp.
    const enemyAfter = vm.renderInput?.state.entities.get(enemy.id) as EnemyEntity | undefined;
    expect(enemyAfter?.hp).toBeLessThan(enemy.maxHp);
  });

  it('click on closed door commits, dispatches INTERACT and cancels path', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    state.explored[6]![5] = true;
    state.player.ap = 1;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 5, y: 6 });

    const vm = session.getViewModel();
    // Автопуть завершается после активации двери.
    expect(vm.renderInput?.highlightedPathCommitted).toBe(false);
    expect(vm.renderInput?.highlightedPathTargetKind).toBe('none');
    const doorAfter = vm.renderInput?.state.entities.get(door.id) as DoorEntity | undefined;
    expect(doorAfter?.isOpen).toBe(true);
  });

  it('click on player position cancels auto-path', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 5, y: 6 });
    // анимации завершены сразу, т.к. нет анимаций
    session.onAnimationsComplete();

    // После автопути игрок переместился; клик на его текущую позицию отменяет путь.
    const playerPos = session.getViewModel().renderInput!.state.player;
    session.handleFieldClick({ x: playerPos.x, y: playerPos.y });

    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPath).toBeNull();
    expect(vm.renderInput?.highlightedPathCommitted).toBe(false);
  });

  it('any keyboard input cancels committed auto-path', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.player.ap = 2;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 5, y: 7 });
    expect(session.isAutoPathCommitted()).toBe(true);

    session.cancelAutoPath();

    expect(session.isAutoPathActive()).toBe(false);
    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPath).toBeNull();
  });

  it('beginTargeting cancels auto-path', () => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([['fireball', {
        id: 'fireball',
        cooldown: 0,
        apCost: 1,
        aiPreparable: false,
        requiredWeaponTags: [],
        tags: [],
        ruleIds: [],
      }]]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
});

    const state = makeGameState();
    state.explored[6]![5] = true;
    state.player.ap = 2;
    state.player.maxAp = 2;
    state.player.abilities = [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }];
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 5, y: 6 });
    expect(session.isAutoPathCommitted()).toBe(true);

    // Дожидаемся завершения всех анимаций (включая ходы AI после END_TURN).
    drainAnimations(session);
    session.beginTargeting('fireball');

    expect(session.isAutoPathActive()).toBe(false);
  });

  it('shows toast when committed auto-path stops due to a newly visible enemy', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 6, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[5]![6] = true;
    state.explored[5]![7] = true;
    state.explored[6]![6] = true;
    state.explored[6]![7] = true;
    // Враг пока не в поле зрения.
    state.visible[6]![6] = false;
    state.player.ap = 2;

    const session = new GameSession();
    session.loadGame(state);

    // Фиксируем автопуть к (7, 5) и делаем первый шаг.
    session.handleFieldClick({ x: 7, y: 5 });
    expect(session.isAutoPathCommitted()).toBe(true);

    // После первого шага враг оказался в зоне видимости.
    state.visible[6]![6] = true;

    // Завершаем анимации — сессия попытается продолжить автопуть.
    session.onAnimationsComplete();

    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPathCommitted).toBe(false);
    expect(vm.toasts).toHaveLength(1);
    expect(vm.toasts[0]?.title).toBe('Обнаружен враг');
    expect(vm.toasts[0]?.message).toBe(
      'Автоматические действия остановлены из-за появления нового врага в зоне видимости.',
    );
  });

  it('suppresses field click after mouse-down cancel during animation', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.player.ap = 2;

    const session = new GameSession();
    session.loadGame(state);

    // Фиксируем автопуть к (5, 7) — совершается первый шаг и начинается анимация.
    session.handleFieldClick({ x: 5, y: 7 });
    expect(session.isAutoPathCommitted()).toBe(true);
    expect(session.getViewModel().renderInput?.phase).toBe('animating');
    expect(session.getViewModel().renderInput?.state.player.y).toBe(6);

    // Имитируем зажатие ЛКМ во время анимации: отмена автопути с блокировкой
    // следующего клика.
    session.cancelAutoPath(true);
    expect(session.isAutoPathCommitted()).toBe(false);

    // Анимация завершена; в реальном UI сразу после этого приходит click.
    session.onAnimationsComplete();

    // Следующий клик по той же цели должен быть проигнорирован.
    session.handleFieldClick({ x: 5, y: 7 });
    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPathCommitted).toBe(false);
    expect(vm.renderInput?.state.player.y).toBe(6);
  });

  it('resumes normal field clicks after a quick click during animation', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.player.ap = 2;

    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 5, y: 7 });
    expect(session.isAutoPathCommitted()).toBe(true);
    expect(session.getViewModel().renderInput?.phase).toBe('animating');

    // Быстрое нажатие и отпускание ЛКМ во время анимации:
    // mousedown отменяет путь и блокирует следующий click.
    session.cancelAutoPath(true);
    expect(session.isAutoPathCommitted()).toBe(false);

    // click во время анимации не доходит до GameSession (isInputBlocked в UI),
    // поэтому флаг suppressNextFieldClick остаётся установленным.
    // Анимация завершается.
    session.onAnimationsComplete();

    // Следующее нажатие мыши в idle сбрасывает защиту (committed уже нет).
    session.cancelAutoPath(false);

    // Тот же click обрабатывается нормально — автопуть начинается сразу.
    session.handleFieldClick({ x: 5, y: 7 });
    expect(session.isAutoPathCommitted()).toBe(true);
  });

  it('rebuilds preview path after hover moves during camera animation', () => {
    const state = makeGameState();
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.explored[8]![5] = true;
    state.player.ap = 2;
    state.player.maxAp = 2;

    const session = new GameSession();
    session.loadGame(state);

    // Hover на (5, 8) — preview к этому тайлу.
    session.setFieldHover({ x: 5, y: 8 });
    expect(session.getViewModel().renderInput?.highlightedPath).toEqual([
      { x: 5, y: 6 },
      { x: 5, y: 7 },
      { x: 5, y: 8 },
    ]);

    // Игрок делает шаг вниз; начинается анимация.
    session.dispatch({ type: 'MOVE', entityId: state.player.id, dx: 0, dy: 1 });
    expect(session.getViewModel().renderInput?.phase).toBe('animating');

    // Во время анимации камера следует за игроком, поэтому hover в мировых
    // координатах смещается на один тайл (с (5, 8) на (5, 7)).
    // setFieldHover вызывается из UI, но preview не перестраивается
    // и не отображается, пока идёт анимация.
    session.setFieldHover({ x: 5, y: 7 });
    expect(session.getViewModel().renderInput?.highlightedPath).toBeNull();

    // Анимации завершены — preview должен перестроиться к актуальному hover.
    drainAnimations(session);
    const vm = session.getViewModel();
    expect(vm.renderInput?.phase).toBe('idle');
    expect(vm.renderInput?.state.player.y).toBe(6);
    expect(vm.renderInput?.highlightedPath).toEqual([{ x: 5, y: 7 }]);
  });

  it('click on tile behind closed door opens door and continues to target', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 4, maxAp: 4 });
    const door = makeDoor({ x: 5, y: 6 });
    const item = makeFloorItemContainer({ x: 5, y: 7 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door], [item.id, item]]),
    });
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.visible[6]![5] = true;
    state.visible[7]![5] = true;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 5, y: 7 });

    // Дожидаемся завершения всего автопути.
    drainAnimations(session);

    const vm = session.getViewModel();
    expect((vm.renderInput?.state.entities.get(door.id) as DoorEntity | undefined)?.isOpen).toBe(true);
    expect(vm.renderInput?.state.player.y).toBe(7);
    expect(vm.renderInput?.highlightedPathCommitted).toBe(false);
    expect(vm.renderInput?.state.player.inventory.length).toBe(1);
  });

  it('turn end indices account for opening a closed door on the path', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 3, maxAp: 3 });
    const door = makeDoor({ x: 5, y: 6 });
    const item = makeFloorItemContainer({ x: 5, y: 7 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door], [item.id, item]]),
    });
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.visible[6]![5] = true;
    state.visible[7]![5] = true;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 5, y: 7 });

    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPathTurnEndIndices).toEqual([1]);
  });

  it('turn end indices stop before door when only enough AP to open it', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 2 });
    const door = makeDoor({ x: 5, y: 6 });
    const item = makeFloorItemContainer({ x: 5, y: 7 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door], [item.id, item]]),
    });
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.visible[6]![5] = true;
    state.visible[7]![5] = true;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 5, y: 7 });

    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPathTurnEndIndices).toEqual([]);
  });

  it('turn end indices end on door tile when AP covers open + move', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 2, maxAp: 2 });
    const door = makeDoor({ x: 5, y: 6 });
    const item = makeFloorItemContainer({ x: 5, y: 7 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door], [item.id, item]]),
    });
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    state.visible[6]![5] = true;
    state.visible[7]![5] = true;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 5, y: 7 });

    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPathTurnEndIndices).toEqual([0]);
  });

  it('turn end indices for open target door mark the door tile', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const door = makeDoor({ x: 5, y: 6, isOpen: true, blocksMovement: false });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    state.explored[6]![5] = true;
    const session = new GameSession();
    session.loadGame(state);

    // Hover до клика: путь виден и заканчивается на клетке двери.
    session.setFieldHover({ x: 5, y: 6 });

    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPathTurnEndIndices).toEqual([0]);
  });
});
