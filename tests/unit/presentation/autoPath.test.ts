import {describe, expect, it, beforeEach, afterEach, vi} from 'vitest';
import '@i18n/config';
import { GameSession } from '../../../src/presentation/gameSession';
import { AutoPathController, type AutoPathQueries } from '../../../src/presentation/autoPathController';
import { findPathTowards } from '../../../src/presentation/pathfinding';
import { GameSimulation } from '../../../src/simulation/simulation';
import { drainAnimations } from '../../helpers/simulation';
import { makeGameState, makePlayer, makeEnemy, makeDoor, makeFloorItemContainer, makeStairs, makeTrap, createTestTerrains } from '../../fixtures/gameState';
import type { Entity, EnemyEntity, DoorEntity, Position } from '../../../src/simulation/types';
import type { ItemTemplate } from '../../../src/content/schemas';
import { initRegistry, resetRegistry } from '../../../src/content/registry';

function initEmptyRegistry() {
  resetRegistry();
  initRegistry({
    terrains: createTestTerrains(),
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
}

function moveTarget(x: number, y: number) {
  return { position: { x, y }, kind: 'move' as const, entityId: null };
}

function makeQueries(state: ReturnType<typeof makeGameState>): AutoPathQueries {
  const simulation = GameSimulation.loadSavedGame(state, false);
  const isTileWalkable = (pos: Position) => simulation.isTileWalkableForPlayer(pos);
  // Зеркалит isTilePassable из GameSession.getAutoPathQueries:
  // закрытая незапертая дверь условно проходима, запертая — нет.
  const isTilePassable = (pos: Position): boolean => {
    if (isTileWalkable(pos)) return true;
    const blockers = simulation.findEntitiesAt(pos).filter((e) => e.blocksMovement);
    if (blockers.length !== 1) return false;
    const door = blockers[0];
    if (!door) return false;
    return door.type === 'door' && door.isAlive !== false && !door.isOpen && !door.isLocked;
  };
  return {
    isTileWalkable,
    isTilePassable,
    findPathTowards: (start, target) => findPathTowards(start, target, isTileWalkable, isTilePassable),
    findAttackPath: (target) => simulation.findNearestAttackPosition(target),
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

  it('builds path through a hidden trap tile (trap does not affect walkability)', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const trap = makeTrap({ x: 5, y: 6, hidden: true });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [trap.id, trap]]),
    });
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;
    const simulation = GameSimulation.loadSavedGame(state, false);

    const path = simulation.findPathForPlayer({ x: 5, y: 5 }, { x: 5, y: 7 });

    expect(path).toEqual([{ x: 5, y: 6 }, { x: 5, y: 7 }]);
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

  it('step returns positional ATTACK when enemy target is in weapon range and cancels path', () => {
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

    // Melee унифицирован: финал — позиционная атака по текущей позиции врага,
    // а не направленный bump.
    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'ATTACK',
        entityId: state.player.id,
        dx: 1,
        dy: 0,
        targetPosition: { x: 6, y: 5 },
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

    // Враг отступил на две клетки — путь перестроился к атакующей клетке,
    // но игрок ещё не в позиции атаки.
    enemy.x = 7;

    const result = controller.step(state, queries);

    // Ближайшая атакующая клетка — (6,5) (визуально ближайшая к игроку
    // среди (6,4),(6,5),(6,6) — прямо по курсу).
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
        targetPosition: { x: 4, y: 5 },
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

  it('does not build path through a locked door when it is the only passage', () => {
    const player = makePlayer({ x: 5, y: 3 });
    const door = makeDoor({ x: 5, y: 5, isOpen: false, blocksMovement: true, isLocked: true });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    // Сплошная стена на y=5, единственный проход — клетка запертой двери (5, 5).
    for (let x = 1; x <= 8; x++) {
      if (x !== 5) state.map.tiles[5]![x] = 'wall';
    }
    // Дверь видима: невидимые объекты pathfinding игнорирует.
    state.visible[5]![5] = true;
    state.explored[5]![5] = true;
    const queries = makeQueries(state);

    const path = queries.findPathTowards({ x: 5, y: 3 }, moveTarget(5, 7));

    expect(path).toBeNull();
  });

  it('step does not emit INTERACT for a locked door target', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6, isOpen: false, blocksMovement: true, isLocked: true });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [door.id, door]]),
    });
    state.explored[6]![5] = true;
    state.visible[6]![5] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 5, y: 6 }, kind: 'door', entityId: door.id }, state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    // Для запертой двери INTERACT не подставляется: контроллер возвращает MOVE,
    // который Simulation отклонит как tile_blocked.
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') return;
    expect(result.action.type).not.toBe('INTERACT');
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

  it('hover on visible enemy in weapon range shows attack overlay instead of a path', () => {
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
    // Враг в зоне поражения — автопуть не строится.
    expect(vm.renderInput?.highlightedPath).toBeNull();
    // Эмуляция подготовки атаки: зона досягаемости + цель.
    const overlay = vm.renderInput?.enemyHoverOverlay;
    expect(overlay).not.toBeNull();
    expect(overlay!.target).toEqual({ x: 6, y: 5 });
    expect(overlay!.inRange).toBe(true);
    // Melee (1/1): вся зона — 8 соседних клеток.
    expect(overlay!.rangeCells).toHaveLength(8);
    expect(overlay!.rangeCells).toContainEqual({ x: 6, y: 5 });
  });

  it('hover on visible enemy out of weapon range builds path to attack cell', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 7, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[5]![6] = true;
    state.explored[5]![7] = true;
    state.visible[5]![6] = true;
    state.visible[5]![7] = true;
    const session = new GameSession();
    session.loadGame(state);

    session.setFieldHover({ x: 7, y: 5 });

    const vm = session.getViewModel();
    // Путь ведёт до ближайшей атакующей клетки, а не в клетку врага
    // (визуально ближайшая к игроку среди (6,4),(6,5),(6,6) — (6,5)).
    expect(vm.renderInput?.highlightedPath).toEqual([{ x: 6, y: 5 }]);
    // Зона досягаемости показывается и в этом случае, цель вне зоны.
    const overlay = vm.renderInput?.enemyHoverOverlay;
    expect(overlay).not.toBeNull();
    expect(overlay!.target).toEqual({ x: 7, y: 5 });
    expect(overlay!.inRange).toBe(false);
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

  it('click on locked door does not open it and does not spend AP', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ x: 5, y: 6, isOpen: false, blocksMovement: true, isLocked: true });
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
    const doorAfter = vm.renderInput?.state.entities.get(door.id) as DoorEntity | undefined;
    // Запертая дверь не открылась и не отперлась, игрок остался на месте.
    expect(doorAfter?.isOpen).toBe(false);
    expect(doorAfter?.isLocked).toBe(true);
    expect(vm.renderInput?.state.player.x).toBe(5);
    expect(vm.renderInput?.state.player.y).toBe(5);
    expect(vm.renderInput?.state.player.ap).toBe(1);
    // Автопуть отменён после отклонённого действия.
    expect(vm.renderInput?.highlightedPathCommitted).toBe(false);
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
      terrains: createTestTerrains(),
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([['fireball', {
        id: 'fireball',
        kind: 'fireball',
        range: 5,
        aoeRadius: 1,
        centerDamage: 20,
        aoeDamage: 10,
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
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
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

  it('turn end indices account for next turn when AP only covers opening the door', () => {
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

    // AP хватает только на открытие двери (1 из 1): во время анимации
    // текущие AP = 0, поэтому отметка считается от очков следующего хода
    // (maxAp=2, два шага до цели → конец хода на индексе 1).
    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPathTurnEndIndices).toEqual([1]);
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

  it('turn end indices start from next turn when AP is zero', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 0, maxAp: 2 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player]]),
    });
    for (let y = 6; y <= 8; y++) {
      state.explored[y]![5] = true;
      state.visible[y]![5] = true;
    }
    const session = new GameSession();
    session.loadGame(state);

    session.setFieldHover({ x: 5, y: 8 });

    // При нулевых AP отметки считаются от очков следующего хода:
    // путь из 3 шагов, maxAp=2 → конец хода на 2-м шаге (индекс 1).
    const vm = session.getViewModel();
    expect(vm.renderInput?.highlightedPathTurnEndIndices).toEqual([1]);
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

// ─────────────────────────────────────────────
// Автопуть к врагу через атакующую клетку (ranged + fallback)
// ─────────────────────────────────────────────

/** Дальнобойная праща 5/2 (аналог common_sling) для ranged-сценариев. */
const SLING_TEMPLATE = {
  id: 'test_sling',
  name: 'Тестовая праща',
  type: 'weapon',
  subtype: 'sling',
  level: 1,
  rarity: 'common',
  stackable: false,
  maxStack: 1,
  value: 0,
  abilityPool: [],
  grantedAbilities: [],
  fixedModifiers: [],
  apCost: 1,
  weapon: {
    damage: { min: 4, max: 6 },
    range: 5,
    minRange: 2,
    damageDistribution: [{ damageTag: 'damage.physical.piercing', weight: 1.0 }],
    tags: ['attack.ranged', 'target.single', 'delivery.weapon'],
  },
} as ItemTemplate;

function initSlingRegistry() {
  resetRegistry();
  initRegistry({
    terrains: createTestTerrains(),
    entities: new Map(),
    players: new Map(),
    items: new Map([[SLING_TEMPLATE.id, SLING_TEMPLATE]]),
    abilities: new Map(),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
  });
}

function makePlayerWithSling(overrides: Parameters<typeof makePlayer>[0] = {}) {
  return makePlayer({
    x: 5,
    y: 5,
    equippedWeaponId: SLING_TEMPLATE.id,
    equippedWeaponInstanceId: `${SLING_TEMPLATE.id}_1`,
    inventory: [
      {
        instanceId: `${SLING_TEMPLATE.id}_1`,
        templateId: SLING_TEMPLATE.id,
        quantity: 1,
        grantedAbilities: [],
        affixes: [],
      },
    ],
    ...overrides,
  });
}

/**
 * Враг, замурованный в коробку 3×3 из стен с единственным выходом —
 * закрытой дверью слева (x-1, y). Атакующей клетки нет (все соседние клетки —
 * стены или непроходимая закрытая дверь), но путь в клетку врага строится
 * через условно проходимую дверь (старое поведение).
 */
function encloseWithDoor(state: ReturnType<typeof makeGameState>, x: number, y: number): DoorEntity {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (dx === -1 && dy === 0) continue; // проём под дверь
      state.map.tiles[y + dy]![x + dx] = 'wall';
    }
  }
  const door = makeDoor({ x: x - 1, y });
  state.entities.set(door.id, door);
  // Дверь видима: невидимые объекты не блокируют проходимость.
  state.visible[y]![x - 1] = true;
  state.explored[y]![x - 1] = true;
  return door;
}

describe('AutoPathController attack position', () => {
  beforeEach(initSlingRegistry);
  afterEach(resetRegistry);

  it('hover on out-of-range enemy builds path to attack cell, not enemy tile', () => {
    // Игрок (1,1), враг (8,8): cheb 7 > range 5 — из текущей позиции не достать.
    const player = makePlayerWithSling({ x: 1, y: 1 });
    const enemy = makeEnemy({ x: 8, y: 8 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[8]![8] = true;
    const { controller, queries } = setupController(state);

    controller.hover({ position: { x: 8, y: 8 }, kind: 'enemy', entityId: enemy.id }, state, queries);

    const path = controller.getPath();
    expect(path).not.toBeNull();
    const last = path![path!.length - 1]!;
    // Путь заканчивается на атакующей клетке, а не на клетке врага.
    expect(last).not.toEqual({ x: 8, y: 8 });
    // С атакующей клетки оружие достаёт врага: cheb ∈ [minRange, range].
    const cheb = Math.max(Math.abs(last.x - 8), Math.abs(last.y - 8));
    expect(cheb).toBeGreaterThanOrEqual(2);
    expect(cheb).toBeLessThanOrEqual(5);
  });

  it('step returns positional ATTACK when ranged weapon already reaches the enemy', () => {
    // Игрок (5,5), враг (7,6): cheb 2 ∈ [2,5] — цель в зоне поражения пращи.
    const player = makePlayerWithSling();
    const enemy = makeEnemy({ x: 7, y: 6 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[6]![7] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 7, y: 6 }, kind: 'enemy', entityId: enemy.id }, state, queries);
    controller.commit();

    const result = controller.step(state, queries);

    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'ATTACK',
        entityId: state.player.id,
        dx: 1,
        dy: 1,
        targetPosition: { x: 7, y: 6 },
      },
    });
    expect(controller.isActive()).toBe(false);
  });

  it('step moves to the attack cell and finishes with positional ATTACK', () => {
    const player = makePlayerWithSling({ x: 1, y: 1 });
    const enemy = makeEnemy({ x: 8, y: 8 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[8]![8] = true;
    const { controller, queries } = setupController(state);
    controller.hover({ position: { x: 8, y: 8 }, kind: 'enemy', entityId: enemy.id }, state, queries);
    controller.commit();

    // Шаги по пути к атакующей клетке.
    let result = controller.step(state, queries);
    expect(result.kind).toBe('action');
    if (result.kind === 'action') expect(result.action.type).toBe('MOVE');
    state.player.x = 2;
    state.player.y = 2;

    result = controller.step(state, queries);
    expect(result.kind).toBe('action');
    if (result.kind === 'action') expect(result.action.type).toBe('MOVE');
    state.player.x = 3;
    state.player.y = 3;

    // Игрок достиг атакующей клетки — финальная позиционная атака.
    result = controller.step(state, queries);
    expect(result).toEqual({
      kind: 'action',
      action: {
        type: 'ATTACK',
        entityId: state.player.id,
        dx: 1,
        dy: 1,
        targetPosition: { x: 8, y: 8 },
      },
    });
    expect(controller.isActive()).toBe(false);
  });

  it('falls back to path toward enemy tile when no attack cell exists', () => {
    // Melee-игрок, враг замурован в стены с закрытой дверью: атакующей клетки
    // нет (все соседние клетки непроходимы), но путь в клетку врага есть.
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 7, y: 2 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    encloseWithDoor(state, 7, 2);
    state.explored[2]![7] = true;
    state.visible[2]![7] = true;
    const { controller, queries } = setupController(state);

    controller.hover({ position: { x: 7, y: 2 }, kind: 'enemy', entityId: enemy.id }, state, queries);

    const path = controller.getPath();
    // Старое поведение: путь строится в клетку врага.
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ x: 7, y: 2 });
  });
});

describe('GameSession click-on-enemy attack', () => {
  beforeEach(initSlingRegistry);
  afterEach(resetRegistry);

  it('click on in-range enemy dispatches positional ATTACK immediately, without auto-path', () => {
    // Праща 5/2, враг (7,5) — в зоне поражения из текущей позиции.
    const player = makePlayerWithSling({ ap: 3, maxAp: 3 });
    const enemy = makeEnemy({ x: 7, y: 5, hp: 20, maxHp: 20 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[5]![7] = true;
    state.visible[5]![7] = true;
    const session = new GameSession();
    session.loadGame(state);
    const dispatchSpy = vi.spyOn(session, 'dispatch');

    session.handleFieldClick({ x: 7, y: 5 });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ATTACK', dx: 1, dy: 0, targetPosition: { x: 7, y: 5 } }),
    );
    expect(session.isAutoPathCommitted()).toBe(false);
    const enemyAfter = session.getViewModel().renderInput?.state.entities.get(enemy.id) as EnemyEntity;
    expect(enemyAfter.hp).toBeLessThan(20);
  });

  it('click on out-of-range enemy commits auto-path and finishes with positional ATTACK', () => {
    // Игрок (1,1), враг (8,8): вне зоны пращи — автопуть до атакующей клетки.
    const player = makePlayerWithSling({ x: 1, y: 1, ap: 10, maxAp: 10 });
    const enemy = makeEnemy({ x: 8, y: 8, hp: 50, maxHp: 50 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    state.explored[8]![8] = true;
    state.visible[8]![8] = true;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 8, y: 8 });
    expect(session.isAutoPathCommitted()).toBe(true);

    // Дожидаемся прохождения всего автопути (AI не ходит: AP игрока хватает).
    drainAnimations(session);

    const vm = session.getViewModel();
    const enemyAfter = vm.renderInput?.state.entities.get(enemy.id) as EnemyEntity;
    expect(enemyAfter.hp).toBeLessThan(50);
    // Финальная атака выполнена с атакующей клетки (3,3), а не впритык.
    expect(vm.renderInput?.state.player.x).toBe(3);
    expect(vm.renderInput?.state.player.y).toBe(3);
    expect(vm.renderInput?.highlightedPathCommitted).toBe(false);
  });

  it('click on enemy without attack cell falls back to path into the enemy tile', () => {
    const player = makePlayer({ x: 5, y: 5, ap: 2, maxAp: 2 });
    const enemy = makeEnemy({ x: 7, y: 2 });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy]]),
    });
    encloseWithDoor(state, 7, 2);
    state.explored[2]![7] = true;
    state.visible[2]![7] = true;
    const session = new GameSession();
    session.loadGame(state);

    session.handleFieldClick({ x: 7, y: 2 });

    const vm = session.getViewModel();
    // Fallback: путь ведёт в клетку врага (старое поведение).
    const path = vm.renderInput?.highlightedPath;
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ x: 7, y: 2 });
    expect(vm.renderInput?.highlightedPathTargetKind).toBe('enemy');
  });
});
