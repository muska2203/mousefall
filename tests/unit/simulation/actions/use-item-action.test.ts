import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import { makeGameState, makePlayer, createTestTerrains } from '../../../fixtures/gameState';
import {useItemAction} from '../../../../src/simulation/systems/actions/use-item-action';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {ItemTemplate, StatusTemplate} from '../../../../src/content/schemas';
import {ItemTemplateSchema} from '../../../../src/content/schemas';
import {buildContent} from '../../../../src/content/templates';
import {GameSimulation, defaultActionHandlerRegistry} from '../../../../src/simulation/simulation';
import {ExecutionBuilder} from '../../../../src/simulation/systems/actions/types';

function mockConsumable(
  id: string,
  effect: NonNullable<ItemTemplate['consumable']>['effect'],
  value?: number,
  extra?: Partial<NonNullable<ItemTemplate['consumable']>>,
): ItemTemplate {
  return {
    id,
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    fixedModifiers: [],
    grantedAbilities: [],
    apCost: 1,
    consumable: { effect, value, ...extra },
  };
}

/** Минимальный мок шаблона статуса для исполнения APPLY_STATUS. */
function mockStatusTemplate(id: string): StatusTemplate {
  return {
    id,
    ruleIds: [],
    statusCategory: 'generic',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    statModifiers: [],
  } as StatusTemplate;
}

function makeBuilder() {
  return new ExecutionBuilder({ type: 'ACTION_APPLIED', isFieldEvent: false, action: { type: 'END_TURN', entityId: 'any' } });
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    terrains: createTestTerrains(),
    entities: new Map(),
    players: new Map(),
    items: new Map([
      ['heal_potion', mockConsumable('heal_potion', 'heal', 30)],
      ['buff_potion', mockConsumable('buff_potion', 'buff', 5)],
      ['water_ball', mockConsumable('water_ball', 'spawn_tile_effect', 0, { tileEffectType: 'water', radius: 1, range: 5 })],
      ['oil_bottle', mockConsumable('oil_bottle', 'spawn_tile_effect', 0, { tileEffectType: 'oil', radius: 1, range: 5 })],
      ['wall_ball', mockConsumable('wall_ball', 'spawn_tile_effect', 0, { tileEffectType: 'water', radius: 1, range: 5 })],
      ['pebble', mockConsumable('pebble', 'spawn_tile_effect', 0, { tileEffectType: 'water', radius: 1, range: 2 })],
      ['frag_bomb', mockConsumable('frag_bomb', 'damage', 6, { damageTag: 'damage.physical.piercing', radius: 1, range: 2 })],
      ['blood_ritual', mockConsumable('blood_ritual', 'applyStatus', undefined, {
        statuses: [
          { statusType: 'bleeding', duration: 3 },
          { statusType: 'regenerating', duration: 2 },
        ],
      })],
      ['test_weapon', {
        id: 'test_weapon',
        type: 'weapon',
        stackable: false,
        maxStack: 1,
        value: 0,
        rarity: 'common',
        abilityPool: [],
        fixedModifiers: [],
        grantedAbilities: [],
        apCost: 1,
      } as unknown as ItemTemplate],
    ]),
    abilities: new Map(),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
    statuses: new Map([
      ['bleeding', mockStatusTemplate('bleeding')],
      ['regenerating', mockStatusTemplate('regenerating')],
    ]),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
});

afterEach(() => {
  resetRegistry();
});

describe('useItemAction.validate', () => {
  it('успех, если предмет — consumable в инвентаре', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(true);
  });

  it('ошибка, если предмета нет в инвентаре', () => {
    const state = makeGameState();
    const player = makePlayer({ inventory: [] });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'missing' };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('item_not_found');
    }
  });

  it('ошибка, если предмет не consumable', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'weapon_1', templateId: 'test_weapon', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'weapon_1' };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('not_consumable');
    }
  });

  it('ошибка для spawn_tile_effect без targetPosition', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'ball_1', templateId: 'water_ball', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'ball_1' };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('missing_target_position');
    }
  });

  it('ошибка для spawn_tile_effect с targetPosition вне досягаемости', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 1,
      y: 1,
      inventory: [{ instanceId: 'ball_1', templateId: 'water_ball', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    // Цель (9,9) — чебышёвская дистанция 8, вне радиуса броска 5.

    const action = {
      type: 'USE_ITEM' as const,
      entityId: 'player',
      itemInstanceId: 'ball_1',
      targetPosition: { x: 9, y: 9 },
    };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('invalid_target_position');
    }
  });

  it('ошибка для damage без targetPosition', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'bomb_1', templateId: 'frag_bomb', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'bomb_1' };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('missing_target_position');
    }
  });

  it('ошибка для damage с targetPosition вне дальности броска', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 1,
      y: 1,
      inventory: [{ instanceId: 'bomb_1', templateId: 'frag_bomb', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    // Цель (9,9) — вне range 2 шаблона frag_bomb.

    const action = {
      type: 'USE_ITEM' as const,
      entityId: 'player',
      itemInstanceId: 'bomb_1',
      targetPosition: { x: 9, y: 9 },
    };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('invalid_target_position');
    }
  });

  it('ошибка при несовпадении templateId', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'ball_1', templateId: 'water_ball', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = {
      type: 'USE_ITEM' as const,
      entityId: 'player',
      itemInstanceId: 'ball_1',
      templateId: 'oil_bottle',
      targetPosition: { x: 6, y: 5 },
    };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('template_id_mismatch');
    }
  });

  it('цель вне range шаблона недоступна без модификатора throwRange', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      inventory: [{ instanceId: 'pebble_1', templateId: 'pebble', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    // Цель (8,5): манхэттен 3 — за пределами range 2 шаблона pebble.

    const action = {
      type: 'USE_ITEM' as const,
      entityId: 'player',
      itemInstanceId: 'pebble_1',
      targetPosition: { x: 8, y: 5 },
    };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('invalid_target_position');
    }
  });

  it('throwRange-модификатор увеличивает дальность броска', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      statModifiers: [{ stat: 'throwRange', value: 1, op: 'add', source: 'test_sling' }],
      inventory: [{ instanceId: 'pebble_1', templateId: 'pebble', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    // Та же цель (8,5): range 2 + throwRange 1 = 3 — теперь достижима.

    const action = {
      type: 'USE_ITEM' as const,
      entityId: 'player',
      itemInstanceId: 'pebble_1',
      targetPosition: { x: 8, y: 5 },
    };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(true);
  });
});

describe('useItemAction.resolve', () => {
  it('для heal возвращает HEAL + REMOVE_ITEM', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 2, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const intents = useItemAction.resolve(state, action);

    expect(intents).toHaveLength(2);
    expect(intents[0]!.type).toBe('HEAL');
    expect(intents[1]!.type).toBe('REMOVE_ITEM');
  });

  it('для buff возвращает APPLY_STATUS + REMOVE_ITEM', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'potion_1', templateId: 'buff_potion', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const intents = useItemAction.resolve(state, action);

    expect(intents).toHaveLength(2);
    expect(intents[0]!.type).toBe('APPLY_STATUS');
    expect(intents[1]!.type).toBe('REMOVE_ITEM');
  });

  it('для spawn_tile_effect возвращает SPAWN_TILE_EFFECT по цели и соседям + REMOVE_ITEM', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'ball_1', templateId: 'water_ball', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    // Клетка (6,5) видима, чтобы валидация не отказала.
    state.visible[5]![6] = true;

    const action = {
      type: 'USE_ITEM' as const,
      entityId: 'player',
      itemInstanceId: 'ball_1',
      targetPosition: { x: 6, y: 5 },
    };
    const intents = useItemAction.resolve(state, action);

    const spawnIntents = intents.filter(i => i.type === 'SPAWN_TILE_EFFECT');
    expect(spawnIntents).toHaveLength(9); // радиус 1: 3×3
    expect(spawnIntents.every(i => i.type === 'SPAWN_TILE_EFFECT' && i.effectType === 'water')).toBe(true);
    expect(intents.some(i => i.type === 'REMOVE_ITEM')).toBe(true);
  });

  it('для damage возвращает TILE_EXPLOSION с параметрами шаблона + REMOVE_ITEM', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      inventory: [{ instanceId: 'bomb_1', templateId: 'frag_bomb', quantity: 2, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    // Клетка (6,5) видима и в дальности броска (range 2).
    state.visible[5]![6] = true;

    const action = {
      type: 'USE_ITEM' as const,
      entityId: 'player',
      itemInstanceId: 'bomb_1',
      targetPosition: { x: 6, y: 5 },
    };
    const intents = useItemAction.resolve(state, action);

    expect(intents).toHaveLength(2);
    expect(intents[0]).toMatchObject({
      type: 'TILE_EXPLOSION',
      position: { x: 6, y: 5 },
      sourceEntityId: 'player',
      damage: 6,
      radius: 1,
      tags: ['damage.physical.piercing'],
    });
    expect(intents[1]!.type).toBe('REMOVE_ITEM');
  });

  it('для oil_bottle возвращает SPAWN_TILE_EFFECT с типом oil', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'bottle_1', templateId: 'oil_bottle', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    state.visible[5]![6] = true;

    const action = {
      type: 'USE_ITEM' as const,
      entityId: 'player',
      itemInstanceId: 'bottle_1',
      targetPosition: { x: 6, y: 5 },
    };
    const intents = useItemAction.resolve(state, action);

    const spawnIntents = intents.filter(i => i.type === 'SPAWN_TILE_EFFECT');
    expect(spawnIntents).toHaveLength(9);
    expect(spawnIntents.every(i => i.type === 'SPAWN_TILE_EFFECT' && i.effectType === 'oil')).toBe(true);
  });

  it('spawn_tile_effect не спавнится на стенах', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 2,
      y: 2,
      inventory: [{ instanceId: 'ball_1', templateId: 'wall_ball', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    state.visible[1]![1] = true;

    const action = {
      type: 'USE_ITEM' as const,
      entityId: 'player',
      itemInstanceId: 'ball_1',
      targetPosition: { x: 1, y: 1 },
    };
    const intents = useItemAction.resolve(state, action);

    const spawnIntents = intents.filter(i => i.type === 'SPAWN_TILE_EFFECT');
    // В 3×3 вокруг (1,1) четыре клетки floor: (1,1), (2,1), (1,2), (2,2).
    // Остальные — стены периметра, они должны быть отфильтрованы.
    expect(spawnIntents).toHaveLength(4);
    expect(spawnIntents.every(i => i.type === 'SPAWN_TILE_EFFECT' && i.effectType === 'water')).toBe(true);
    const positions = spawnIntents.map(i => i.position);
    expect(positions).not.toContainEqual({ x: 0, y: 0 });
    expect(positions).not.toContainEqual({ x: 1, y: 0 });
    expect(positions).not.toContainEqual({ x: 2, y: 0 });
    expect(positions).not.toContainEqual({ x: 0, y: 1 });
    expect(positions).not.toContainEqual({ x: 0, y: 2 });
  });
});

describe('useItemAction.execute', () => {
  it('восстанавливает HP и уменьшает quantity', () => {
    const state = makeGameState();
    const player = makePlayer({
      hp: 50,
      maxHp: 100,
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 2, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const intents = useItemAction.resolve(state, action);
    const builder = makeBuilder();
    useItemAction.execute(state, action, intents, builder, builder.root);

    expect(player.hp).toBe(80);
    expect(player.inventory[0]!.quantity).toBe(1);
  });

  it('не превышает maxHp при лечении', () => {
    const state = makeGameState();
    const player = makePlayer({
      hp: 90,
      maxHp: 100,
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const intents = useItemAction.resolve(state, action);
    const builder = makeBuilder();
    useItemAction.execute(state, action, intents, builder, builder.root);

    expect(player.hp).toBe(100);
  });

  it('удаляет предмет из инвентаря, если quantity была 1', () => {
    const state = makeGameState();
    const player = makePlayer({
      hp: 50,
      maxHp: 100,
      inventory: [{ instanceId: 'potion_1', templateId: 'heal_potion', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'potion_1' };
    const intents = useItemAction.resolve(state, action);
    const builder = makeBuilder();
    useItemAction.execute(state, action, intents, builder, builder.root);

    expect(player.inventory).toHaveLength(0);
  });
});

describe('эффект applyStatus (план bleed-builds, этап 1.3)', () => {
  it('validate: успех без targetPosition (self-эффект, таргетинг по клетке не требуется)', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'ritual_1', templateId: 'blood_ritual', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'ritual_1' };
    const result = useItemAction.validate(state, action);
    expect(result.ok).toBe(true);
  });

  it('resolve: APPLY_STATUS на себя по каждому статусу из statuses + REMOVE_ITEM', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'ritual_1', templateId: 'blood_ritual', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'ritual_1' };
    const intents = useItemAction.resolve(state, action);

    expect(intents).toHaveLength(3);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: 'player',
      sourceEntityId: 'player',
      status: { type: 'bleeding', duration: 3, value: 0, statModifiers: null },
    });
    expect(intents[1]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: 'player',
      sourceEntityId: 'player',
      status: { type: 'regenerating', duration: 2, value: 0, statModifiers: null },
    });
    expect(intents[2]!.type).toBe('REMOVE_ITEM');
  });

  it('execute: оба статуса накладываются на игрока', () => {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'ritual_1', templateId: 'blood_ritual', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'ritual_1' };
    const intents = useItemAction.resolve(state, action);
    const builder = makeBuilder();
    useItemAction.execute(state, action, intents, builder, builder.root);

    expect(player.statusEffects).toContainEqual(
      expect.objectContaining({ type: 'bleeding', duration: 3 }),
    );
    expect(player.statusEffects).toContainEqual(
      expect.objectContaining({ type: 'regenerating', duration: 2 }),
    );
    expect(player.inventory).toHaveLength(0);
  });

  it('таргетинг: getConsumableTargetMode возвращает null (выбор клетки не требуется)', () => {
    const state = makeGameState();
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    expect(sim.getConsumableTargetMode('blood_ritual')).toBeNull();
  });
});

describe('ConsumableEffectSchema: applyStatus', () => {
  const baseItem = { id: 'test_apply_status_item', type: 'consumable' };

  it('отклоняет applyStatus без поля statuses', () => {
    expect(() => ItemTemplateSchema.parse({
      ...baseItem,
      consumable: { effect: 'applyStatus' },
    })).toThrow();
  });

  it('отклоняет applyStatus с пустым statuses', () => {
    expect(() => ItemTemplateSchema.parse({
      ...baseItem,
      consumable: { effect: 'applyStatus', statuses: [] },
    })).toThrow();
  });

  it('отклоняет статус с duration < 1', () => {
    expect(() => ItemTemplateSchema.parse({
      ...baseItem,
      consumable: { effect: 'applyStatus', statuses: [{ statusType: 'bleeding', duration: 0 }] },
    })).toThrow();
  });

  it('принимает applyStatus с непустым statuses', () => {
    const parsed = ItemTemplateSchema.parse({
      ...baseItem,
      consumable: {
        effect: 'applyStatus',
        statuses: [
          { statusType: 'bleeding', duration: 3 },
          { statusType: 'regenerating', duration: 2 },
        ],
      },
    });

    expect(parsed.consumable?.statuses).toHaveLength(2);
  });
});

describe('ritual_cut — реальный контент (план bleed-builds, этап 5)', () => {
  // Переопределяем мок-реестр файла настоящим контентом из src/content/templates.
  beforeEach(() => {
    resetRegistry();
    initRegistry(buildContent());
  });

  function makeStateWithRitualCut() {
    const state = makeGameState();
    const player = makePlayer({
      inventory: [{ instanceId: 'cut_1', templateId: 'ritual_cut', quantity: 1, grantedAbilities: [], affixes: [] }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    return { state, player };
  }

  it('execute: вешает на игрока bleeding (3 хода) и empowered (2 хода), предмет расходуется', () => {
    const { state, player } = makeStateWithRitualCut();

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'cut_1' };
    expect(useItemAction.validate(state, action).ok).toBe(true);
    const intents = useItemAction.resolve(state, action);
    const builder = makeBuilder();
    useItemAction.execute(state, action, intents, builder, builder.root);

    expect(player.statusEffects).toContainEqual(
      expect.objectContaining({ type: 'bleeding', duration: 3 }),
    );
    expect(player.statusEffects).toContainEqual(
      expect.objectContaining({ type: 'empowered', duration: 2 }),
    );
    expect(player.inventory).toHaveLength(0);
  });

  it('execute: statModifiers шаблона empowered реально дают +2 к урону', () => {
    const { state, player } = makeStateWithRitualCut();

    const action = { type: 'USE_ITEM' as const, entityId: 'player', itemInstanceId: 'cut_1' };
    const intents = useItemAction.resolve(state, action);
    const builder = makeBuilder();
    useItemAction.execute(state, action, intents, builder, builder.root);

    expect(player.statModifiers).toContainEqual(
      expect.objectContaining({ stat: 'damage', value: 2, op: 'add' }),
    );
  });

  it('таргетинг: getConsumableTargetMode возвращает null (выбор клетки не требуется)', () => {
    const state = makeGameState();
    const sim = new GameSimulation(state, defaultActionHandlerRegistry());

    expect(sim.getConsumableTargetMode('ritual_cut')).toBeNull();
  });
});
