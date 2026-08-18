import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { treeRoomStrategy } from '../../../src/simulation/systems/map-generation/tree-room-strategy';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import { makeGameState } from '../../fixtures/gameState';
import { createRNG } from '../../../src/utils/rng';
import type { DoorTemplate, EntityTemplate, MapParams, PoiTemplate, PropTemplate, RoomFill, RoomTypeTemplate } from '../../../src/content/schemas';

function makeParams(overrides: Partial<MapParams> = {}): MapParams {
  return {
    id: 'test_tree',
    strategy: 'tree',
    width: 20,
    height: 20,
    minRooms: 3,
    maxRooms: 5,
    roomTypePool: ['normal', 'rare'],
    startRoomTypeId: 'start',
    bossRoomTypeId: 'boss',
    bossDoorId: 'boss_door',
    rewardRoomTypeId: 'reward',
    ...overrides,
  };
}

function makeRoomType(id: string, overrides: Partial<Omit<RoomTypeTemplate, 'fill'>> & { fill?: Partial<RoomFill> } = {}): RoomTypeTemplate {
  const { fill, ...rest } = overrides;
  const defaultFill: RoomFill = {
    enemyPool: [],
    enemyDensity: 0,
    itemPool: [],
    itemDensity: 0,
    propPool: [],
    propDensity: 0,
    trapPool: [],
    trapDensity: 0,
    tileEffectPool: [],
    tileEffectDensity: 0,
    guaranteedPois: [],
  };
  return {
    id,
    kind: 'generated',
    weight: 1,
    minDepth: 0,
    minSize: 4,
    maxSize: 6,
    ...rest,
    fill: Object.assign({}, defaultFill, fill),
  } as RoomTypeTemplate;
}

describe('treeRoomStrategy: типы комнат', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map<string, DoorTemplate>([
        ['wooden_door', { id: 'wooden_door', maxHp: 30, armor: 2 } as DoorTemplate],
      ]),
      stairs: new Map(),
      pois: new Map<string, PoiTemplate>([
        ['test_poi', {
          id: 'test_poi',
          interactionKind: 'poi',
          ruleIds: [],
          charges: 1,
          chargeSpentOn: 'activation',
          tags: [],
        } as PoiTemplate],
      ]),
      statuses: new Map(),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
      roomTypes: new Map<string, RoomTypeTemplate>([
        ['start', makeRoomType('start', { fill: { guaranteedPois: ['test_poi'] } })],
        ['normal', makeRoomType('normal')],
        ['rare', makeRoomType('rare', { maxPerFloor: 1 })],
        ['plain', makeRoomType('plain')],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('корень дерева получает startRoomTypeId и гарантированный poi его типа', () => {
    const state = makeGameState({ rng: createRNG(42) });
    const result = treeRoomStrategy.generate(makeParams(), state, 1, 5);

    const root = result.map.rooms[0]!;
    expect(root.roomTypeId).toBe('start');

    expect(result.pois.length).toBe(1);
    const poi = result.pois[0]!;
    expect(poi.templateId).toBe('test_poi');

    // Внутри корневой комнаты и не на клетке спавна.
    expect(poi.x).toBeGreaterThanOrEqual(root.x);
    expect(poi.x).toBeLessThan(root.x + root.width);
    expect(poi.y).toBeGreaterThanOrEqual(root.y);
    expect(poi.y).toBeLessThan(root.y + root.height);
    expect(poi.x === result.playerStart.x && poi.y === result.playerStart.y).toBe(false);
  });

  it('назначает типы из roomTypePool остальным комнатам и не перекрывает двери', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const result = treeRoomStrategy.generate(makeParams(), state, 2, 5);

      for (const room of result.map.rooms.slice(1)) {
        expect(['normal', 'rare']).toContain(room.roomTypeId);
      }

      // Гарантированный poi не занимает клетку спавна (там stairsUp на этажах > 1)
      // и не пересекается с дверями (слот solid).
      if (result.pois.length > 0) {
        const poi = result.pois[0]!;
        expect(poi.x === result.playerStart.x && poi.y === result.playerStart.y).toBe(false);
        for (const door of result.doors) {
          expect(door.x === poi.x && door.y === poi.y).toBe(false);
        }
      }
    }
  });

  it('уважает maxPerFloor при назначении типов', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const result = treeRoomStrategy.generate(makeParams({ minRooms: 5, maxRooms: 8 }), state, 1, 5);

      const rareRooms = result.map.rooms.filter(r => r.roomTypeId === 'rare');
      expect(rareRooms.length).toBeLessThanOrEqual(1);
    }
  });

  it('не размещает poi, если у типа стартовой комнаты пустые guaranteedPois', () => {
    const state = makeGameState({ rng: createRNG(42) });
    const result = treeRoomStrategy.generate(makeParams({ startRoomTypeId: 'plain' }), state, 1, 5);

    expect(result.pois.length).toBe(0);
  });

  it('детерминирован по seed (типы комнат и позиция poi)', () => {
    const params = makeParams();
    const first = treeRoomStrategy.generate(params, makeGameState({ rng: createRNG(7) }), 1, 5);
    const second = treeRoomStrategy.generate(params, makeGameState({ rng: createRNG(7) }), 1, 5);

    expect(first.map.rooms.map(r => r.roomTypeId)).toEqual(second.map.rooms.map(r => r.roomTypeId));
    expect(first.pois.length).toBe(1);
    expect({ x: first.pois[0]!.x, y: first.pois[0]!.y }).toEqual({ x: second.pois[0]!.x, y: second.pois[0]!.y });
  });
});

describe('treeRoomStrategy: босс-инфраструктура', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map<string, EntityTemplate>([
        ['test_boss', {
          id: 'test_boss',
          isBoss: true,
          maxAp: 1,
          aiStrategyId: 'hunter',
          aiSightRadius: 4,
          health: { max: 30 },
          baseStats: { str: 3, dex: 1, int: 0, vit: 2 },
        } as EntityTemplate],
      ]),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map<string, DoorTemplate>([
        ['wooden_door', { id: 'wooden_door', maxHp: 30, armor: 2 } as DoorTemplate],
        ['boss_door', { id: 'boss_door', maxHp: 100, armor: 5, indestructible: true } as DoorTemplate],
      ]),
      stairs: new Map(),
      pois: new Map(),
      statuses: new Map(),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
      roomTypes: new Map<string, RoomTypeTemplate>([
        ['start', makeRoomType('start')],
        ['normal', makeRoomType('normal')],
        ['rare', makeRoomType('rare', { maxPerFloor: 1 })],
        ['boss', makeRoomType('boss', { weight: 0, maxPerFloor: 1 })],
        ['reward', makeRoomType('reward', { weight: 0, maxPerFloor: 1 })],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('при bossPool босс-комната — самый дальний узел, за ней ровно одна reward с лестницей вниз', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const result = treeRoomStrategy.generate(makeParams({ bossPool: ['test_boss'] }), state, 1, 5);

      const bossRooms = result.map.rooms.filter(r => r.roomTypeId === 'boss');
      const rewardRooms = result.map.rooms.filter(r => r.roomTypeId === 'reward');
      expect(bossRooms.length).toBe(1);
      expect(rewardRooms.length).toBe(1);

      // Лестница вниз остаётся в центре exit-комнаты, которая теперь — reward.
      const reward = rewardRooms[0]!;
      expect(result.stairsDown).toEqual({
        x: Math.floor(reward.x + reward.width / 2),
        y: Math.floor(reward.y + reward.height / 2),
      });

      // Остальные некорневые комнаты роллятся из roomTypePool, как раньше.
      for (const room of result.map.rooms.slice(1)) {
        if (room === bossRooms[0] || room === reward) continue;
        expect(['normal', 'rare']).toContain(room.roomTypeId);
      }
    }
  });

  it('спавнит босса из bossPool в центре босс-комнаты', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const result = treeRoomStrategy.generate(makeParams({ bossPool: ['test_boss'] }), state, 1, 5);

      const bossRoom = result.map.rooms.find(r => r.roomTypeId === 'boss')!;
      const bosses = result.enemies.filter(e => e.templateId === 'test_boss');
      expect(bosses.length).toBe(1);

      const boss = bosses[0]!;
      expect(boss.x).toBe(Math.floor(bossRoom.x + bossRoom.width / 2));
      expect(boss.y).toBe(Math.floor(bossRoom.y + bossRoom.height / 2));
      expect(boss.x).toBeGreaterThanOrEqual(bossRoom.x);
      expect(boss.x).toBeLessThan(bossRoom.x + bossRoom.width);
      expect(boss.y).toBeGreaterThanOrEqual(bossRoom.y);
      expect(boss.y).toBeLessThan(bossRoom.y + bossRoom.height);
    }
  });

  it('двери на коридорах босс-комнаты создаются шаблоном boss_door', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const result = treeRoomStrategy.generate(makeParams({ bossPool: ['test_boss'] }), state, 1, 5);

      const bossRoom = result.map.rooms.find(r => r.roomTypeId === 'boss')!;
      const bossDoors = result.doors.filter(d => d.templateId === 'boss_door');
      // Минимум по двери на коридоре «родитель → босс» и «босс → reward».
      expect(bossDoors.length).toBeGreaterThanOrEqual(2);

      // Каждая дверь, примыкающая к босс-комнате (вплотную к её границе), — boss_door.
      let touching = 0;
      for (const door of result.doors) {
        const touchesBossRoom =
          door.x >= bossRoom.x - 1 && door.x <= bossRoom.x + bossRoom.width &&
          door.y >= bossRoom.y - 1 && door.y <= bossRoom.y + bossRoom.height;
        if (!touchesBossRoom) continue;
        touching++;
        expect(door.templateId).toBe('boss_door');
      }
      expect(touching).toBeGreaterThanOrEqual(2);
    }
  });

  it('детерминирован по seed с bossPool (типы комнат, двери, босс)', () => {
    const params = makeParams({ bossPool: ['test_boss'] });
    const first = treeRoomStrategy.generate(params, makeGameState({ rng: createRNG(7) }), 1, 5);
    const second = treeRoomStrategy.generate(params, makeGameState({ rng: createRNG(7) }), 1, 5);

    expect(first.map.rooms.map(r => r.roomTypeId)).toEqual(second.map.rooms.map(r => r.roomTypeId));
    expect(first.doors.map(d => ({ templateId: d.templateId, x: d.x, y: d.y })))
      .toEqual(second.doors.map(d => ({ templateId: d.templateId, x: d.x, y: d.y })));
    expect(first.enemies.map(e => ({ templateId: e.templateId, x: e.x, y: e.y })))
      .toEqual(second.enemies.map(e => ({ templateId: e.templateId, x: e.x, y: e.y })));
  });

  it('без bossPool комнат boss/reward нет и все двери — wooden_door', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const result = treeRoomStrategy.generate(makeParams(), state, 1, 5);

      expect(result.map.rooms.some(r => r.roomTypeId === 'boss')).toBe(false);
      expect(result.map.rooms.some(r => r.roomTypeId === 'reward')).toBe(false);
      expect(result.enemies.some(e => e.templateId === 'test_boss')).toBe(false);
      for (const door of result.doors) {
        expect(door.templateId).toBe('wooden_door');
      }
    }
  });
});

describe('treeRoomStrategy: зарезервированные клетки', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map<string, EntityTemplate>([
        ['test_boss', {
          id: 'test_boss',
          isBoss: true,
          maxAp: 1,
          aiStrategyId: 'hunter',
          aiSightRadius: 4,
          health: { max: 30 },
          baseStats: { str: 3, dex: 1, int: 0, vit: 2 },
        } as EntityTemplate],
      ]),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map<string, DoorTemplate>([
        ['wooden_door', { id: 'wooden_door', maxHp: 30, armor: 2 } as DoorTemplate],
        ['boss_door', { id: 'boss_door', maxHp: 100, armor: 5, indestructible: true } as DoorTemplate],
      ]),
      stairs: new Map(),
      pois: new Map<string, PoiTemplate>([
        ['test_poi', {
          id: 'test_poi',
          interactionKind: 'poi',
          ruleIds: [],
          charges: 1,
          chargeSpentOn: 'activation',
          tags: [],
        } as PoiTemplate],
      ]),
      props: new Map([
        ['test_prop', {
          id: 'test_prop',
          maxHp: 3,
          armor: 0,
          blocksMovement: true,
          blocksLOS: false,
          propKind: 'barrel',
          tags: [],
          canHaveStatus: [],
        } as PropTemplate],
      ]),
      statuses: new Map(),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
      roomTypes: new Map<string, RoomTypeTemplate>([
        ['start', makeRoomType('start')],
        ['normal', makeRoomType('normal')],
        // Высокая плотность пропов и гарантированный poi: центр exit-комнаты
        // (лестница вниз) и центр босс-комнаты наверняка попали бы под размещение.
        ['reward', makeRoomType('reward', {
          weight: 0, maxPerFloor: 1,
          fill: { propPool: ['test_prop'], propDensity: 8, guaranteedPois: ['test_poi'] },
        })],
        ['boss', makeRoomType('boss', {
          weight: 0, maxPerFloor: 1,
          fill: { propPool: ['test_prop'], propDensity: 8 },
        })],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('клетка лестницы вниз свободна от врагов и объектов размещения', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const result = treeRoomStrategy.generate(makeParams({ bossPool: ['test_boss'] }), state, 1, 5);

      expect(result.stairsDown).not.toBeNull();
      const stairs = result.stairsDown!;
      const spawned = [
        ...result.enemies, ...result.items, ...result.props, ...result.traps, ...result.pois,
      ];
      for (const entity of spawned) {
        expect(entity.x === stairs.x && entity.y === stairs.y).toBe(false);
      }
    }
  });

  it('центр босс-комнаты свободен: босс спавнится в нём, объекты — нет', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = makeGameState({ rng: createRNG(seed) });
      const result = treeRoomStrategy.generate(makeParams({ bossPool: ['test_boss'] }), state, 1, 5);

      const bossRoom = result.map.rooms.find(r => r.roomTypeId === 'boss')!;
      const center = {
        x: Math.floor(bossRoom.x + bossRoom.width / 2),
        y: Math.floor(bossRoom.y + bossRoom.height / 2),
      };

      const boss = result.enemies.find(e => e.templateId === 'test_boss')!;
      expect({ x: boss.x, y: boss.y }).toEqual(center);

      for (const prop of result.props) {
        expect(prop.x === center.x && prop.y === center.y).toBe(false);
      }
    }
  });
});
