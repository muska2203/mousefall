/**
 * Unit tests for UnitInfoRenderer.
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
    width = 64;
    height = 64;
    destroyed = false;
    texture = MockTexture.EMPTY;
    anchor = {
      x: 0.5,
      y: 1,
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
    x = 0;
    y = 0;
    visible = true;
    zIndex = 0;
    scale = {
      x: 1,
      y: 1,
      set(x: number, y?: number) {
        (this as any).x = x;
        (this as any).y = y ?? x;
      },
    };
    addChild(c: any) { this.children.push(c); return c; }
    removeChildren() { this.children = []; }
    destroy() {}
  }
  class MockGraphics {
    x = 0;
    y = 0;
    visible = true;
    scale = { x: 1, y: 1 };
    rect() { return this; }
    circle() { return this; }
    fill() { return this; }
    clear() { return this; }
    destroy() {}
  }
  class MockAssets {
    static load() {
      return Promise.resolve(new MockTexture());
    }
  }
  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: MockTexture,
    Graphics: MockGraphics,
    Assets: MockAssets,
  };
});

vi.mock('../../../../src/ui/renderer/TextureCache', () => {
  const fakeTexture = {url: 'fake'};
  return {
    getTextureSync: vi.fn(() => undefined),
    getTexture: vi.fn(() => Promise.resolve(fakeTexture)),
    hasTexture: vi.fn(() => false),
    clearTextures: vi.fn(),
  };
});

import {UnitInfoRenderer} from '../../../../src/ui/renderer/UnitInfoRenderer';
import {Sprite} from 'pixi.js';
import type {RenderInput, StatusEffect} from '../../../../src/presentation/types';

function makeRenderInput(debugEnabled: boolean): RenderInput {
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
  };

  return {
    state: {
      map: {width: 10, height: 10, tiles: [], rooms: [], corridors: []},
      mapParams: {
        id: 'floor_1',
        strategy: 'tree',
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
      visible: [],
      explored: [],
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
    doorSprites: new Map(),
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
    hotbar: [],
    activeEffects: [],
    statusEffectsByEntity: new Map(),
    runStats: {
      startTime: Date.now(),
      enemiesKilled: 0,
      chestsOpened: 0,
      itemsPickedUp: 0,
    },
    fieldObjectPopover: null,
    interactionHint: null,
    aiPreparedIntents: [],
    debugEnabled,
    mapgenDebugEnabled: false,
  };
}

describe('UnitInfoRenderer', () => {
  beforeEach(() => {
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('creates a widget for each entity with HP regardless of debug flag', () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));

    expect(renderer.container.children.length).toBe(1);
    expect((renderer as any).widgets.has('player')).toBe(true);
  });

  it('clears widgets when entity disappears', () => {
    const renderer = new UnitInfoRenderer();
    const withEnemy = makeRenderInput(false);
    const withoutEnemy = makeRenderInput(false);
    withEnemy.state.entities.set('enemy1', {
      id: 'enemy1',
      type: 'enemy',
      x: 1,
      y: 1,
      blocksMovement: true,
      hp: 3,
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
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());
    sprites.set('enemy1', new Sprite());

    renderer.update(withEnemy, (id) => sprites.get(id));
    expect((renderer as any).widgets.size).toBe(2);

    renderer.update(withoutEnemy, (id) => sprites.get(id));
    expect((renderer as any).widgets.size).toBe(1);
    expect((renderer as any).widgets.has('enemy1')).toBe(false);
  });

  it('animates HP change with tween', async () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');
    expect(widget).toBeDefined();

    const p = renderer.animateHpChange('player', 10, 5, 10, {duration: 10, blocking: false, easing: (t) => t});
    expect(p).toBeInstanceOf(Promise);

    renderer.updateAnimations(performance.now() + 20);
    await p;

    expect(widget.lastHpRatio).toBe(0.5);
  });

  it('hides effect slots when entity has no status effects', () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');

    expect(widget.effectSlots.every((slot: Sprite) => !slot.visible)).toBe(true);
  });

  it('shows effect sprites and overflow icon when there are more than 4 effects', async () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const effects: StatusEffect[] = [
      {type: 'burning', duration: 2, value: 1, statModifiers: null},
      {type: 'poisoned', duration: 3, value: 2, statModifiers: null},
      {type: 'frozen', duration: 1, value: 0, statModifiers: null},
      {type: 'parry', duration: 2, value: 0, statModifiers: null},
      {type: 'regenerating', duration: 5, value: 1, statModifiers: null},
    ];
    input.statusEffectsByEntity.set('player', effects);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    // Дождаться асинхронной подгрузки текстур в applyTexture.
    await new Promise((resolve) => setImmediate(resolve));

    const widget = (renderer as any).widgets.get('player');

    expect(widget.effectSlots[0].visible).toBe(true);
    expect(widget.effectSlots[1].visible).toBe(true);
    expect(widget.effectSlots[2].visible).toBe(true);
    expect(widget.effectSlots[3].visible).toBe(true);
  });
});
