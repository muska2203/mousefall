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
    factionId: 'player' as const,
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
      turn: {activeSide: 'player' as const, round: 1},
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
    highlightedPathCommitted: false,
    highlightedPathTargetKind: 'none',
    highlightedPathTurnEndIndices: [],
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
    aiModeByEntity: new Map(),
    runStats: {
      startTime: Date.now(),
      enemiesKilled: 0,
      chestsOpened: 0,
      itemsPickedUp: 0,
    },
    fieldObjectPopover: null,
    interactionHint: null,
    aiPreparedIntents: [],
    currentTurnSide: 'player',
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

  it('starts chained HP change from current visual value, not from step fromHp', async () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    input.state.player.hp = 100;
    input.state.player.maxHp = 100;
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');

    // Первая анимация 100 → 80, останавливаем на середине (90).
    const first = renderer.animateHpChange('player', 100, 80, 100, {duration: 10, blocking: false, easing: (t) => t});
    renderer.updateAnimations(performance.now() + 5);
    expect(widget.lastHpRatio).toBeCloseTo(0.9, 3);

    // Вторая анимация приходит до завершения первой: 80 → 60.
    // Полоска не должна прыгать к 80, а продолжать плавно с текущего 90.
    const second = renderer.animateHpChange('player', 80, 60, 100, {duration: 10, blocking: false, easing: (t) => t});
    expect(widget.lastHpRatio).toBeCloseTo(0.9, 3);

    renderer.updateAnimations(performance.now() + 20);
    await Promise.all([first, second]);

    expect(widget.lastHpRatio).toBe(0.6);
  });

  it('does not snap HP bar to final value when HP_CHANGE animation is planned', () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    input.state.player.hp = 5;
    input.animations = [
      {
        side: 'player',
        nodes: [
          {
            step: {type: 'HP_CHANGE', entityId: 'player', fromHp: 10, toHp: 5, maxHp: 10, position: {x: 0, y: 0}},
            children: [],
          },
        ],
      },
    ];

    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');

    // Полоска не должна резко упасть до 0.5: анимация сама установит начальное
    // заполнение (fromHp) при старте.
    expect(widget.lastHpRatio).toBe(1);
  });

  it('hides HP bar when HP is full and shows it when HP is not full', () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');

    expect(widget.hpBarBg.visible).toBe(false);
    expect(widget.hpBarFill.visible).toBe(false);

    input.state.player.hp = 5;
    renderer.update(input, (id) => sprites.get(id));

    expect(widget.hpBarBg.visible).toBe(true);
    expect(widget.hpBarFill.visible).toBe(true);
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

  it('delays newly added status effect sprites until animations finish', async () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');
    expect(widget.effectSlots.every((slot: Sprite) => !slot.visible)).toBe(true);

    input.phase = 'animating';
    input.statusEffectsByEntity = new Map([
      ['player', [{type: 'burning', duration: 2, value: 1, statModifiers: null} as StatusEffect]],
    ]);
    renderer.update(input, (id) => sprites.get(id));
    await new Promise((resolve) => setImmediate(resolve));

    expect(widget.effectSlots.every((slot: Sprite) => !slot.visible)).toBe(true);

    input.phase = 'idle';
    renderer.update(input, (id) => sprites.get(id));
    await new Promise((resolve) => setImmediate(resolve));

    expect(widget.effectSlots[0].visible).toBe(true);
  });

  it('reserves layout space for status effects before their texture loads', async () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');

    // Виджет без эффектов и с полным HP компактный
    // (40 = PADDING + круг + PADDING, бар скрыт).
    expect(widget.contentHeight).toBe(40);

    input.statusEffectsByEntity = new Map([
      ['player', [{type: 'burning', duration: 2, value: 1, statModifiers: null} as StatusEffect]],
    ]);
    renderer.update(input, (id) => sprites.get(id));

    // Текстура ещё не подгружена, но место под слот уже зарезервировано.
    // При полном HP бар скрыт, поэтому высота 60, а не 74.
    expect(widget.effectSlots[0].visible).toBe(false);
    expect(widget.effectSlots[0].y).toBe(40);
    expect(widget.contentHeight).toBe(60);

    await new Promise((resolve) => setImmediate(resolve));

    // После загрузки текстуры спрайт появляется на том же месте.
    // При полном HP бар остаётся скрыт.
    expect(widget.effectSlots[0].visible).toBe(true);
    expect(widget.effectSlots[0].y).toBe(40);
    expect(widget.contentHeight).toBe(60);
  });

  it('does not draw fallback background when no primary status is provided', () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');

    expect(widget.statusIcon.visible).toBe(false);
    expect(widget.statusBg).toBeUndefined();
  });

  it('shows primary status icon when provided', async () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    input.aiModeByEntity.set('player', 'idle');
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    await new Promise((resolve) => setImmediate(resolve));

    const widget = (renderer as any).widgets.get('player');
    expect(widget.statusIcon.visible).toBe(true);
  });

  it('hides primary status icon when status is removed', async () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    input.aiModeByEntity.set('player', 'idle');
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    await new Promise((resolve) => setImmediate(resolve));

    const widget = (renderer as any).widgets.get('player');
    expect(widget.statusIcon.visible).toBe(true);

    input.aiModeByEntity.delete('player');
    renderer.update(input, (id) => sprites.get(id));

    expect(widget.statusIcon.visible).toBe(false);
  });

  it('delays newly added primary status until animations finish', async () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');
    expect(widget.statusIcon.visible).toBe(false);

    input.phase = 'animating';
    input.aiModeByEntity.set('player', 'chase');
    renderer.update(input, (id) => sprites.get(id));
    await new Promise((resolve) => setImmediate(resolve));

    expect(widget.statusIcon.visible).toBe(false);

    input.phase = 'idle';
    renderer.update(input, (id) => sprites.get(id));
    await new Promise((resolve) => setImmediate(resolve));

    expect(widget.statusIcon.visible).toBe(true);
  });

  it('shows prepared ability icon as primary status when provided', async () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    input.aiModeByEntity.set('player', 'prepared');
    input.aiPreparedIntents = [
      {
        entityId: 'player',
        abilityId: 'fireball',
        name: 'Fireball',
        icon: '/assets/skills/fireball.png',
        fixedTargets: [{x: 1, y: 1}],
        affectedPositions: [{x: 1, y: 1}],
        intents: [],
      },
    ];
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    await new Promise((resolve) => setImmediate(resolve));

    const widget = (renderer as any).widgets.get('player');
    expect(widget.statusIcon.visible).toBe(true);
  });
});
