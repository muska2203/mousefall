/**
 * Интеграционный сценарий: контроллер запирания босс-комнаты (roadMap 1.3).
 *
 * Проверяет сквозное поведение через GameSimulation на вручную собранном
 * состоянии с босс-комнатой (roomTypeId 'boss' в map.rooms, mapParams с
 * bossRoomTypeId, двери boss_door с тегом boss_room, босс-мок с isBoss):
 * - вход игрока при живом боссе внутри → все босс-двери закрыты и заперты;
 * - обычная дверь (wooden_door) не затрагивается;
 * - смерть босса → двери отперты насовсем, повторный вход не запирает;
 * - вход при боссе снаружи / при мёртвом боссе → не запирается.
 *
 * Краевые случаи (выход при живом боссе, идемпотентность, телепорт и др.)
 * покрыты юнит-тестами `tests/unit/simulation/world-reactions/boss-room-reaction.test.ts`.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createTestSimulation} from '../helpers/simulation';
import {
  initObjectContentRegistry,
  makeDoor,
  makeEnemy,
  makeGameState,
  makePlayer,
} from '../fixtures/gameState';
import {resetRegistry} from '../../src/content/registry';
import type {EntityTemplate} from '../../src/content/schemas';
import type {ExecutionNode, GameEvent} from '../../src/simulation/core-types';
import type {EntityId, Entity, GameState, SimulationResult} from '../../src/simulation/types';

function makeEntityTemplate(partial: Partial<EntityTemplate> = {}): EntityTemplate {
  return {
    id: 'test_enemy',
    health: {max: 10},
    baseStats: {str: 0, dex: 0, int: 0, vit: 0},
    attack: {
      damage: {min: 1, max: 1},
      range: 1,
      minRange: 1,
      damageDistribution: [{damageTag: 'damage.physical.blunt', weight: 1.0}],
      tags: ['attack.melee', 'target.single', 'delivery.weapon'],
    },
    armor: 0,
    modifiers: [],
    abilities: [],
    lootTable: [],
    lootDropTable: [],
    aiSightRadius: 6,
    aiStrategyId: 'hunter',
    maxAp: 1,
    isBoss: false,
    ...partial,
  };
}

function findEvents(node: ExecutionNode, predicate: (e: GameEvent) => boolean): GameEvent[] {
  const results: GameEvent[] = [];
  if (predicate(node.event)) results.push(node.event);
  for (const child of node.children) results.push(...findEvents(child, predicate));
  return results;
}

function findResultEvents(result: SimulationResult, predicate: (e: GameEvent) => boolean): GameEvent[] {
  return result.phases.flatMap((phase) => phase.actions.flatMap((node) => findEvents(node, predicate)));
}

/** Босс-комната: x 5..8, y 2..7. Двери на коридорных клетках x=4 — снаружи комнаты. */
function makeBossRoomState(bossOverrides: Parameters<typeof makeEnemy>[0] = {}): {
  state: GameState;
  boss: ReturnType<typeof makeEnemy>;
  doorA: ReturnType<typeof makeDoor>;
  doorB: ReturnType<typeof makeDoor>;
  wooden: ReturnType<typeof makeDoor>;
} {
  const player = makePlayer({
    x: 3,
    y: 4,
    maxAp: 10,
    ap: 10,
    baseStats: {str: 50, dex: 0, int: 0, vit: 0},
  });
  const boss = makeEnemy({id: 'boss_1', templateId: 'test_boss', x: 6, y: 4, ...bossOverrides});
  const doorA = makeDoor({id: 'door_a', templateId: 'boss_door', x: 4, y: 4, isOpen: true, blocksMovement: false});
  const doorB = makeDoor({id: 'door_b', templateId: 'boss_door', x: 4, y: 6, isOpen: true, blocksMovement: false});
  const wooden = makeDoor({id: 'door_w', templateId: 'wooden_door', x: 2, y: 7, isOpen: true, blocksMovement: false});
  const state = makeGameState({
    player,
    entities: new Map<EntityId, Entity>([
      [player.id, player],
      [boss.id, boss],
      [doorA.id, doorA],
      [doorB.id, doorB],
      [wooden.id, wooden],
    ]),
  });
  state.map.rooms = [
    {x: 5, y: 2, width: 4, height: 6, roomTypeId: 'boss'},
    {x: 1, y: 1, width: 3, height: 8, roomTypeId: 'normal'},
  ];
  return {state, boss, doorA, doorB, wooden};
}

describe('Запирание босс-комнаты (интеграция)', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      entities: new Map([
        ['test_boss', makeEntityTemplate({id: 'test_boss', isBoss: true})],
        ['test_enemy', makeEntityTemplate({id: 'test_enemy'})],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('вход игрока: все босс-двери закрыты и заперты, обычная дверь не тронута', () => {
    const {state, doorA, doorB, wooden} = makeBossRoomState();
    const sim = createTestSimulation(state);

    // Шаг на клетку открытой двери — ещё снаружи комнаты, запирания нет.
    const stepOnDoor = sim.dispatch({type: 'MOVE', entityId: 'player', dx: 1, dy: 0});
    expect(stepOnDoor.success).toBe(true);
    expect(doorA.isLocked).toBe(false);

    // Шаг внутрь комнаты — запирание.
    const entry = sim.dispatch({type: 'MOVE', entityId: 'player', dx: 1, dy: 0});
    expect(entry.success).toBe(true);
    expect(state.player.x).toBe(5);

    expect(doorA.isOpen).toBe(false);
    expect(doorA.isLocked).toBe(true);
    expect(doorB.isOpen).toBe(false);
    expect(doorB.isLocked).toBe(true);
    expect(findResultEvents(entry, (e) => e.type === 'DOOR_LOCKED').length).toBe(2);

    // Обычная дверь без тега boss_room не затронута.
    expect(wooden.isOpen).toBe(true);
    expect(wooden.isLocked).toBe(false);
  });

  it('смерть босса: двери отперты насовсем, повторный вход не запирает', () => {
    const {state, boss, doorA, doorB} = makeBossRoomState({hp: 1, maxHp: 1});
    const sim = createTestSimulation(state);

    // Вход (два шага: на дверь, затем внутрь) — комната заперта.
    sim.dispatch({type: 'MOVE', entityId: 'player', dx: 1, dy: 0});
    sim.dispatch({type: 'MOVE', entityId: 'player', dx: 1, dy: 0});
    expect(doorA.isLocked).toBe(true);
    expect(doorB.isLocked).toBe(true);

    // Игрок в (5,4), босс в (6,4) — убить одной атакой.
    const kill = sim.dispatch({type: 'ATTACK', entityId: 'player', dx: 1, dy: 0});
    expect(kill.success).toBe(true);
    expect(boss.isAlive).toBe(false);

    // Смерть последнего босса отпирает двери (насоваем).
    expect(doorA.isLocked).toBe(false);
    expect(doorB.isLocked).toBe(false);
    expect(findResultEvents(kill, (e) => e.type === 'DOOR_UNLOCKED').length).toBe(2);

    // Двери остались закрытыми, но теперь открываются взаимодействием.
    expect(doorA.isOpen).toBe(false);
    const open = sim.dispatch({type: 'INTERACT', entityId: 'player', targetId: doorA.id});
    expect(open.success).toBe(true);
    expect(doorA.isOpen).toBe(true);

    // Выход и повторный вход: запирания нет, открытая дверь не закрывается.
    const exit = sim.dispatch({type: 'MOVE', entityId: 'player', dx: -1, dy: 0});
    expect(exit.success).toBe(true);
    const reentry = sim.dispatch({type: 'MOVE', entityId: 'player', dx: 1, dy: 0});
    expect(reentry.success).toBe(true);
    expect(state.player.x).toBe(5);

    expect(doorA.isOpen).toBe(true);
    expect(doorA.isLocked).toBe(false);
    expect(doorB.isOpen).toBe(false);
    expect(doorB.isLocked).toBe(false);
    expect(findResultEvents(reentry, (e) => e.type === 'DOOR_LOCKED').length).toBe(0);
  });

  it('вход при живом боссе вне комнаты: не запирается', () => {
    const {state, doorA, doorB} = makeBossRoomState({x: 2, y: 2});
    const sim = createTestSimulation(state);

    sim.dispatch({type: 'MOVE', entityId: 'player', dx: 1, dy: 0});
    const entry = sim.dispatch({type: 'MOVE', entityId: 'player', dx: 1, dy: 0});
    expect(entry.success).toBe(true);
    expect(state.player.x).toBe(5);

    expect(doorA.isOpen).toBe(true);
    expect(doorA.isLocked).toBe(false);
    expect(doorB.isOpen).toBe(true);
    expect(doorB.isLocked).toBe(false);
  });

  it('вход при мёртвом боссе: не запирается', () => {
    const {state, doorA, doorB} = makeBossRoomState({isAlive: false, blocksMovement: false});
    const sim = createTestSimulation(state);

    sim.dispatch({type: 'MOVE', entityId: 'player', dx: 1, dy: 0});
    const entry = sim.dispatch({type: 'MOVE', entityId: 'player', dx: 1, dy: 0});
    expect(entry.success).toBe(true);
    expect(state.player.x).toBe(5);

    expect(doorA.isLocked).toBe(false);
    expect(doorB.isLocked).toBe(false);
  });
});
