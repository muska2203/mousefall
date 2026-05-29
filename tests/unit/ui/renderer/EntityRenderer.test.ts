/**
 * Unit tests for EntityRenderer.
 */

import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';

vi.mock('pixi.js', () => {
  class MockTexture {
    static EMPTY = new MockTexture();
    static from() { return new MockTexture(); }
  }
  class MockSprite {
    x = 0;
    y = 0;
    alpha = 1;
    visible = true;
    width = 0;
    height = 0;
    texture = MockTexture.EMPTY;
    anchor = {
      x: 0,
      y: 0,
      set(x: number, y?: number) {
        (this as any).x = x;
        (this as any).y = y ?? x;
      },
    };
    scale = {
      x: 1,
      y: 1,
      set(x: number, y?: number) {
        (this as any).x = x;
        (this as any).y = y ?? x;
      },
    };
    destroy() {}
    static from() { return new MockSprite(); }
  }
  class MockContainer {
    children: any[] = [];
    sortableChildren = false;
    addChild(c: any) { this.children.push(c); }
    removeChildren() { this.children = []; }
    destroy() {}
  }
  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: MockTexture,
  };
});

import {EntityRenderer} from '../../../../src/ui/renderer/EntityRenderer';
import {ANIMATION_CONFIG} from '../../../../src/utils/animationConfig';
import type {RenderInput} from '../../../../src/presentation/types';

function makeRenderInput(playerOverrides?: Partial<RenderInput['state']['player']>, visible?: boolean[][]): RenderInput {
  const player = {
    id: 'player' as const,
    type: 'player' as const,
    displayName: 'Герой',
    templateId: 'witcher',
    x: 0,
    y: 0,
    blocksMovement: true as const,
    isAlive: true,
    hp: 10,
    maxHp: 10,
    armor: 0,
    damage: 2,
    maxAp: 3,
    ap: 3,
    xp: 0,
    level: 1,
    inventory: [],
    equippedWeaponId: null,
    equippedArmorId: null,
    equippedAmuletId: null,
    equippedWeaponInstanceId: null,
    equippedArmorInstanceId: null,
    equippedAmuletInstanceId: null,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    statModifiers: [],
    dodgeChance: 0,
    accuracy: 0,
    critChance: 0,
    critMultiplier: 1.5,
    statusEffects: [],
    abilities: [],
    activeCast: null,
    ...playerOverrides,
  };

  return {
    state: {
      map: {width: 10, height: 10, tiles: [], rooms: []},
      mapParams: {
        id: 'floor_1',
        height: 10,
        width: 10,
        minRooms: 1,
        maxRooms: 2,
        minRoomSize: 3,
        maxRoomSize: 4,
        enemyDensity: 0,
        itemDensity: 0,
        enemyPool: [],
        itemPool: [],
      },
      entities: new Map(),
      player,
      visible: visible ?? [],
      explored: visible ?? [],
      turn: {activeSide: 'PLAYER' as const, round: 1},
      phase: 'playing' as const,
      floor: 1,
      floorSnapshots: [],
      rng: {seed: 1, state: 1},
      nextEntityCounter: 0,
      runStats: {
        startTime: Date.now(),
        enemiesKilled: 0,
        chestsOpened: 0,
        itemsPickedUp: 0,
      },
    },
    highlightedPath: null,
    animations: null,
    phase: 'idle' as const,
    zoom: 1,
    playerStats: {
      level: player.level,
      xp: player.xp,
      hp: player.hp,
      maxHp: player.maxHp,
      ap: player.ap,
      maxAp: player.maxAp,
      baseStats: player.baseStats,
      effectiveStats: player.baseStats,
      damage: player.damage,
      armor: player.armor,
      dodgeChance: player.dodgeChance,
      accuracy: player.accuracy,
      critChance: player.critChance,
      critMultiplier: player.critMultiplier,
    },
    equipment: {
      weaponId: null,
      armorId: null,
      amuletId: null,
      weaponInstanceId: null,
      armorInstanceId: null,
      amuletInstanceId: null,
      weaponDamage: null,
    },
    targetingOverlay: null,
    animationBatchId: 0,
    playerSkills: [],
    heroStats: [],
    equipSlots: [],
    itemsOnFloor: [],
    inventory: [],
    activeEffects: [],
    runStats: {
      startTime: Date.now(),
      enemiesKilled: 0,
      chestsOpened: 0,
      itemsPickedUp: 0,
    },
    fieldObjectPopover: null,
  };
}

describe('EntityRenderer', () => {
  beforeEach(() => {
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('animateMove returns a Promise<void>', async () => {
    const renderer = new EntityRenderer();
    const input = makeRenderInput();
    renderer.update(input);

    const p = renderer.animateMove(
      'player',
      {x: 0, y: 0},
      {x: 1, y: 0},
      ANIMATION_CONFIG.MOVE
    );

    expect(p).toBeInstanceOf(Promise);

    // Завершаем анимацию вручную через ticker
    renderer.updateAnimations(performance.now() + ANIMATION_CONFIG.MOVE.duration + 10);
    await p;
  });

  it('interrupts previous animateMove when called again before finish', async () => {
    const renderer = new EntityRenderer();
    const input = makeRenderInput();
    renderer.update(input);

    const firstPromise = renderer.animateMove(
      'player',
      {x: 0, y: 0},
      {x: 1, y: 0},
      ANIMATION_CONFIG.MOVE
    );

    // Вторая анимация прерывает первую
    const secondPromise = renderer.animateMove(
      'player',
      {x: 1, y: 0},
      {x: 2, y: 0},
      ANIMATION_CONFIG.MOVE
    );

    // Первая Promise должна быть резолвлена (прервана)
    await firstPromise;

    // Завершаем вторую анимацию через ticker вручную
    renderer.updateAnimations(performance.now() + ANIMATION_CONFIG.MOVE.duration + 10);
    await secondPromise;

    const sprite = (renderer as any).sprites.get('player');
    expect(sprite.x).toBe(2 * 32 + 32 / 2); // TILE_SIZE = 32, акторы центрируются по X
    expect(sprite.y).toBe(32 * 0.85); // акторы смещены вверх на 15% от низа тайла
  });

  it('keeps sprite alive during update if DEATH animation is scheduled', () => {
    const renderer = new EntityRenderer();
    const input = makeRenderInput();

    // Добавляем врага в состояние
    input.state.entities.set('enemy1', {
      id: 'enemy1',
      type: 'enemy',
      x: 1,
      y: 1,
      blocksMovement: true,
      hp: 0,
      maxHp: 5,
      armor: 0,
      damage: 1,
      maxAp: 1,
      ap: 0,
      templateId: 'cat_small',
      aiStrategyId: 'melee',
      statusEffects: [],
      abilities: [],
      activeCast: null,
    } as any);

    renderer.update(input);
    expect((renderer as any).sprites.has('enemy1')).toBe(true);

    // Удаляем врага из состояния (симуляция его убила)
    input.state.entities.delete('enemy1');

    // Без анимации смерти спрайт должен быть удалён
    renderer.update(input);
    expect((renderer as any).sprites.has('enemy1')).toBe(false);

    // Добавляем врага снова
    input.state.entities.set('enemy1', {
      id: 'enemy1',
      type: 'enemy',
      x: 1,
      y: 1,
      blocksMovement: true,
      hp: 0,
      maxHp: 5,
      armor: 0,
      damage: 1,
      maxAp: 1,
      ap: 0,
      templateId: 'cat_small',
      aiStrategyId: 'melee',
      statusEffects: [],
      abilities: [],
      activeCast: null,
    } as any);
    renderer.update(input);
    expect((renderer as any).sprites.has('enemy1')).toBe(true);

    // Удаляем врага, но запланируем анимацию смерти
    input.state.entities.delete('enemy1');
    input.animations = [
      [
        {
          step: {type: 'DEATH', entityId: 'enemy1'},
          children: [],
        },
      ],
    ];

    renderer.update(input);
    // Спрайт должен остаться, чтобы отыграть анимацию смерти
    expect((renderer as any).sprites.has('enemy1')).toBe(true);
  });

  it('does not snap sprite to new position before MOVE animation starts', () => {
    const renderer = new EntityRenderer();
    const input = makeRenderInput();

    // Добавляем врага в начальную позицию
    input.state.entities.set('enemy1', {
      id: 'enemy1',
      type: 'enemy',
      x: 1,
      y: 1,
      blocksMovement: true,
      hp: 5,
      maxHp: 5,
      armor: 0,
      damage: 1,
      maxAp: 1,
      ap: 1,
      templateId: 'cat_small',
      aiStrategyId: 'melee',
      statusEffects: [],
      abilities: [],
      activeCast: null,
    } as any);

    renderer.update(input);
    const sprite = (renderer as any).sprites.get('enemy1');
    expect(sprite.x).toBe(1 * 32 + 32 / 2);
    expect(sprite.y).toBe(1 * 32 + 32 * 0.85);

    // Симуляция переместила врага, но анимация ещё не запущена
    input.state.entities.set('enemy1', {
      ...(input.state.entities.get('enemy1') as any),
      x: 3,
      y: 3,
    });
    input.animations = [
      [
        {
          step: {type: 'MOVE', entityId: 'enemy1', from: {x: 1, y: 1}, to: {x: 3, y: 3}},
          children: [],
        },
      ],
    ];

    renderer.update(input);
    // Спрайт должен остаться на старой позиции, а не "прыгнуть" на новую
    expect(sprite.x).toBe(1 * 32 + 32 / 2);
    expect(sprite.y).toBe(1 * 32 + 32 * 0.85);
  });

  it('hides item sprite during update when ITEM_DROP animation is scheduled', () => {
    const renderer = new EntityRenderer();
    // Сделаем клетку (3,3) видимой
    const visible = Array.from({ length: 10 }, () => Array(10).fill(false));
    visible[3]![3] = true;
    const input = makeRenderInput(undefined, visible);

    input.state.entities.set('item1', {
      id: 'item1',
      type: 'item',
      x: 3,
      y: 3,
      templateId: 'health_potion',
      blocksMovement: false,
      displayName: 'Зелье',
      item: {
        instanceId: 'item1',
        templateId: 'health_potion',
        quantity: 1,
        grantedAbilities: [],
      },
    } as any);

    renderer.update(input);
    const sprite = (renderer as any).sprites.get('item1');
    expect(sprite.visible).toBe(true);

    // Запланируем анимацию появления
    input.animations = [
      [
        {
          step: {type: 'ITEM_DROP', itemId: 'item1', position: {x: 3, y: 3}, from: {x: 2, y: 2}, templateId: 'health_potion'},
          children: [],
        },
      ],
    ];

    renderer.update(input);
    // Спрайт должен быть скрыт до начала анимации
    expect(sprite.visible).toBe(false);
  });

  it('animateItemDrop moves sprite from death tile to target tile with fade-in', async () => {
    const renderer = new EntityRenderer();
    const input = makeRenderInput();

    input.state.entities.set('item1', {
      id: 'item1',
      type: 'item',
      x: 3,
      y: 3,
      templateId: 'health_potion',
      blocksMovement: false,
      displayName: 'Зелье',
      item: {
        instanceId: 'item1',
        templateId: 'health_potion',
        quantity: 1,
        grantedAbilities: [],
      },
    } as any);

    renderer.update(input);
    const sprite = (renderer as any).sprites.get('item1');

    const p = renderer.animateItemDrop(
      'item1',
      {x: 2, y: 2},
      {x: 3, y: 3},
      ANIMATION_CONFIG.ITEM_DROP
    );

    expect(p).toBeInstanceOf(Promise);
    // Сразу после старта спрайт должен быть на from и невидим
    expect(sprite.x).toBe(2 * 32);
    expect(sprite.y).toBe(2 * 32);
    expect(sprite.visible).toBe(true);
    expect(sprite.alpha).toBe(0);

    // Завершаем анимацию вручную
    renderer.updateAnimations(performance.now() + ANIMATION_CONFIG.ITEM_DROP.duration + 10);
    await p;

    // По завершении спрайт должен быть на to
    expect(sprite.x).toBe(3 * 32);
    expect(sprite.y).toBe(3 * 32);
    expect(sprite.alpha).toBe(1);
  });
});
