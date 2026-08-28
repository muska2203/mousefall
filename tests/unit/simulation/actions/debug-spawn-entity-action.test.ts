import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  createDebugSpawnEntityActionHandler
} from '../../../../src/simulation/systems/actions/debug-spawn-entity-action';
import { makeEnemy, makeGameState, makePlayer, makeStateWithPlayerAndEntity, createTestTerrains } from '../../../fixtures/gameState';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';

function makeBuilder() {
  return new ExecutionBuilder({type: 'ACTION_APPLIED', isFieldEvent: false, action: {type: 'END_TURN', entityId: 'player'}});
}

function makeContext(enabled: boolean) {
  return {enabled};
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    terrains: createTestTerrains(),
    entities: new Map([
      ['cat_small', {
        id: 'cat_small',
        health: {max: 20},
        baseStats: {str: 1, dex: 1, int: 0, vit: 0},
        aiSightRadius: 6,
        aiStrategyId: 'hunter',
        attack: {
          damage: {min: 1, max: 1},
          range: 1,
          minRange: 1,
          damageDistribution: [{damageTag: 'damage.physical.blunt', weight: 1.0}],
          tags: ['attack.melee', 'target.single', 'delivery.weapon'],
        },
        armor: 0,
        modifiers: [],
      } as any],
    ]),
    players: new Map(),
    items: new Map([
      ['health_potion', {
        id: 'health_potion',
        type: 'consumable',
        stackable: false,
        maxStack: 1,
        value: 0,
        abilityPool: [],
        grantedAbilities: [],
      } as any],
    ]),
    abilities: new Map(),
    maps: new Map(),
    doors: new Map([
      ['wooden_door', {id: 'wooden_door', maxHp: 30, armor: 0} as any],
    ]),
    stairs: new Map([
      ['stairs_down', {id: 'stairs_down'} as any],
      ['stairs_up', {id: 'stairs_up'} as any],
    ]),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
    pois: new Map([
      ['altar', {id: 'altar', interactionKind: 'poi', ruleIds: [], charges: 1} as any],
    ]),
    traps: new Map([
      ['spikes', {id: 'spikes', ruleIds: [], oneShot: true, initiallyHidden: true} as any],
    ]),
});
});

afterEach(() => {
  resetRegistry();
});

describe('createDebugSpawnEntityActionHandler', () => {
  it('спавнит предмет на пустой клетке', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'item' as const,
      templateId: 'health_potion',
      position: {x: 3, y: 3},
    };
    const builder = makeBuilder();

    expect(handler.validate(state, action).ok).toBe(true);
    handler.execute(state, action, [], builder, builder.root);

    const spawned = Array.from(state.entities.values()).find(e => e.type === 'floor_item_container');
    expect(spawned).toBeDefined();
    expect(spawned?.x).toBe(3);
    expect(spawned?.y).toBe(3);
  });

  it('спавнит врага на пустой клетке', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'enemy' as const,
      templateId: 'cat_small',
      position: {x: 3, y: 3},
    };
    const builder = makeBuilder();

    expect(handler.validate(state, action).ok).toBe(true);
    handler.execute(state, action, [], builder, builder.root);

    const spawned = Array.from(state.entities.values()).find(e => e.type === 'enemy');
    expect(spawned).toBeDefined();
  });

  it('спавнит дверь на пустой клетке', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'door' as const,
      templateId: 'wooden_door',
      position: {x: 3, y: 3},
    };
    const builder = makeBuilder();

    expect(handler.validate(state, action).ok).toBe(true);
    handler.execute(state, action, [], builder, builder.root);

    const spawned = Array.from(state.entities.values()).find(e => e.type === 'door');
    expect(spawned).toBeDefined();
  });

  it('спавнит лестницу', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'stairs' as const,
      templateId: 'stairs_down',
      position: {x: 3, y: 3},
    };
    const builder = makeBuilder();

    expect(handler.validate(state, action).ok).toBe(true);
    handler.execute(state, action, [], builder, builder.root);

    const spawned = Array.from(state.entities.values()).find(e => e.type === 'stairs');
    expect(spawned).toBeDefined();
    expect(spawned?.templateId).toBe('stairs_down');
  });

  it('отклоняет действие при выключенном debug', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(false));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'item' as const,
      templateId: 'health_potion',
      position: {x: 3, y: 3},
    };

    const validation = handler.validate(state, action);
    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('debug_disabled');
  });

  it('отклоняет спавн на стене', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'item' as const,
      templateId: 'health_potion',
      position: {x: 0, y: 0},
    };

    const validation = handler.validate(state, action);
    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('not_a_floor_tile');
  });

  it('отклоняет спавн врага на занятой клетке', () => {
    const player = makePlayer({x: 5, y: 5});
    const enemy = makeEnemy({x: 3, y: 3});
    const state = makeStateWithPlayerAndEntity(player, enemy);
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'enemy' as const,
      templateId: 'cat_small',
      position: {x: 3, y: 3},
    };

    const validation = handler.validate(state, action);
    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('tile_occupied');
  });

  it('разрешает спавн предмета на клетке игрока', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'item' as const,
      templateId: 'health_potion',
      position: {x: 5, y: 5},
    };

    expect(handler.validate(state, action).ok).toBe(true);
  });

  it('отклоняет спавн врага на клетке игрока', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'enemy' as const,
      templateId: 'cat_small',
      position: {x: 5, y: 5},
    };

    const validation = handler.validate(state, action);
    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('tile_occupied');
  });

  it('resolve возвращает пустой массив интентов', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'item' as const,
      templateId: 'health_potion',
      position: {x: 3, y: 3},
    };

    expect(handler.resolve(state, action)).toEqual([]);
  });

  it('спавнит точку интереса (poi) на пустой клетке', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'poi' as const,
      templateId: 'altar',
      position: {x: 3, y: 3},
    };
    const builder = makeBuilder();

    expect(handler.validate(state, action).ok).toBe(true);
    handler.execute(state, action, [], builder, builder.root);

    const spawned = Array.from(state.entities.values()).find(e => e.type === 'poi');
    expect(spawned).toBeDefined();
    expect(spawned?.templateId).toBe('altar');
  });

  it('отклоняет спавн poi на клетке с дверью (solid несовместим с solid)', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    handler.execute(state, {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'door' as const,
      templateId: 'wooden_door',
      position: {x: 3, y: 3},
    }, [], makeBuilder(), makeBuilder().root);

    const validation = handler.validate(state, {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'poi' as const,
      templateId: 'altar',
      position: {x: 3, y: 3},
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('tile_occupied');
  });

  it('отклоняет спавн лестницы на клетке с дверью (floorFixture несовместим с solid)', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    handler.execute(state, {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'door' as const,
      templateId: 'wooden_door',
      position: {x: 3, y: 3},
    }, [], makeBuilder(), makeBuilder().root);

    const validation = handler.validate(state, {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'stairs' as const,
      templateId: 'stairs_down',
      position: {x: 3, y: 3},
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('tile_occupied');
  });

  it('разрешает спавн предмета на клетке с лестницей (loot совместим с floorFixture)', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    handler.execute(state, {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'stairs' as const,
      templateId: 'stairs_down',
      position: {x: 3, y: 3},
    }, [], makeBuilder(), makeBuilder().root);

    const validation = handler.validate(state, {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'item' as const,
      templateId: 'health_potion',
      position: {x: 3, y: 3},
    });

    expect(validation.ok).toBe(true);
  });

  it('спавнит ловушку (trap) на пустой клетке', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    const action = {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'trap' as const,
      templateId: 'spikes',
      position: {x: 3, y: 3},
    };
    const builder = makeBuilder();

    expect(handler.validate(state, action).ok).toBe(true);
    handler.execute(state, action, [], builder, builder.root);

    const spawned = Array.from(state.entities.values()).find(e => e.type === 'trap');
    expect(spawned).toBeDefined();
    expect(spawned?.templateId).toBe('spikes');
    expect((spawned as any)?.hidden).toBe(true);
  });

  it('отклоняет спавн ловушки на клетке с лестницей (floorFixture несовместим с floorFixture)', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    handler.execute(state, {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'stairs' as const,
      templateId: 'stairs_down',
      position: {x: 3, y: 3},
    }, [], makeBuilder(), makeBuilder().root);

    const validation = handler.validate(state, {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'trap' as const,
      templateId: 'spikes',
      position: {x: 3, y: 3},
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('tile_occupied');
  });

  it('отклоняет спавн второго предмета на клетке с предметом (loot не стакуется)', () => {
    const state = makeGameState();
    const handler = createDebugSpawnEntityActionHandler(makeContext(true));
    handler.execute(state, {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'item' as const,
      templateId: 'health_potion',
      position: {x: 3, y: 3},
    }, [], makeBuilder(), makeBuilder().root);

    const validation = handler.validate(state, {
      type: 'DEBUG_SPAWN_ENTITY' as const,
      entityId: 'player',
      spawnType: 'item' as const,
      templateId: 'health_potion',
      position: {x: 3, y: 3},
    });

    expect(validation.ok).toBe(false);
    expect((validation as any).reasonCode).toBe('tile_occupied');
  });
});
