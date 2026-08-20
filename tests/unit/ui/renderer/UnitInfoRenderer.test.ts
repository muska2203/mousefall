/**
 * Unit tests for UnitInfoRenderer.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import {UnitInfoRenderer} from '../../../../src/ui/renderer/UnitInfoRenderer';
import {Sprite} from 'pixi.js';
import type {RenderInput, StatusEffect} from '../../../../src/presentation/types';
import {buildDisplayState} from '../../../../src/presentation/displayState/builder';
import type {GameState} from '../../../../src/simulation/types';

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
  class MockAssets {
    static load() {
      return Promise.resolve(new MockTexture());
    }
  }
  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: MockTexture,
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
    damage: { min: 2, max: 2 },
    maxAp: 3,
    ap: 3,
    inventory: [],
    equippedWeaponId: null,
    equippedArmorId: null,
    equippedAmuletId: null,
    equippedWeaponInstanceId: null,
    equippedArmorInstanceId: null,
    equippedAmuletInstanceId: null,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    statModifiers: [],
    critMultiplier: 1.5,
    statusEffects: [],
    abilities: [],
    activeRules: [],
    relics: [],
    factionId: 'player' as const,
  };

  const state: GameState = {
    map: {width: 10, height: 10, tiles: [], rooms: [], corridors: []},
    tileEffects: [],
    mapParams: {
      id: 'floor_1',
      strategy: 'tree',
      height: 10,
      width: 10,
      minRooms: 1,
      maxRooms: 2,
      roomTypePool: ['normal'],
      startRoomTypeId: 'start',
      bossRoomTypeId: 'boss',
      bossDoorId: 'boss_door',
      rewardRoomTypeId: 'reward',
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
    runtimeRng: {seed: 1, state: 1},
    nextEntityCounter: 0,
    runStats: {
      startTime: Date.now(),
      enemiesKilled: 0,
      chestsOpened: 0,
      itemsPickedUp: 0,
      defeatedBossIds: [],
    },
    featureFlags: {
      contentRulesEnabled: false,
    },
  };

  return {
    state,
    displayState: buildDisplayState(state),
    highlightedPath: null,
    highlightedPathCommitted: false,
    highlightedPathTargetKind: 'none',
    highlightedPathTurnEndIndices: [],
    objectSprites: new Map(),
    animations: null,
    phase: 'idle' as const,
    zoom: 1,
    playerStats: {
      hp: player.hp,
      maxHp: player.maxHp,
      ap: player.ap,
      maxAp: player.maxAp,
      baseStats: player.baseStats,
      effectiveStats: player.baseStats,
      damage: player.damage,
      armor: player.armor,
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
    relics: [],
    hotbar: [],
    activeEffects: [],
    statusEffectsByEntity: new Map(),
    aiModeByEntity: new Map(),
    runStats: {
      startTime: Date.now(),
      enemiesKilled: 0,
      chestsOpened: 0,
      itemsPickedUp: 0,
      defeatedBossIds: [],
    },
    fieldObjectPopover: null,
    interactionHint: null,
    aiPreparedIntents: [],
    currentTurnSide: 'player',
    debugEnabled,
    mapgenDebugEnabled: false,
    pendingWindow: null,
    enemyHoverOverlay: null,
  };
}

function refreshDisplayState(input: RenderInput): void {
  input.displayState = buildDisplayState(input.state);
}

describe('UnitInfoRenderer', () => {
  beforeEach(() => {
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
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
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
    refreshDisplayState(withEnemy);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());
    sprites.set('enemy1', new Sprite());

    renderer.update(withEnemy, (id) => sprites.get(id));
    expect((renderer as any).widgets.size).toBe(2);

    renderer.update(withoutEnemy, (id) => sprites.get(id));
    expect((renderer as any).widgets.size).toBe(1);
    expect((renderer as any).widgets.has('enemy1')).toBe(false);
  });

  it('removes widget immediately when entity dies', () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    input.state.entities.set('enemy1', {
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
      isAlive: true,
    } as any);
    refreshDisplayState(input);
    const sprites = new Map<string, Sprite>();
    sprites.set('player', new Sprite());
    sprites.set('enemy1', new Sprite());

    renderer.update(input, (id) => sprites.get(id));
    expect((renderer as any).widgets.size).toBe(2);

    // Враг умирает, но ещё не удалён из DisplayState — виджет должен исчезнуть сразу.
    const enemy = input.displayState.entities.get('enemy1');
    if (enemy) {
      enemy.isAlive = false;
    }

    renderer.update(input, (id) => sprites.get(id));
    expect((renderer as any).widgets.size).toBe(1);
    expect((renderer as any).widgets.has('enemy1')).toBe(false);
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
      {type: 'counterattack', duration: 2, value: 0, statModifiers: null},
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

  it('shows newly added status effect sprites immediately regardless of animation phase', async () => {
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

    // С DisplayState эффекты рисуются сразу, без блокировки на время анимации.
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

  it('shows newly added primary status icon immediately regardless of animation phase', async () => {
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

    // С DisplayState иконка статуса обновляется сразу, без блокировки на время анимации.
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

  it('positions widget above the actual sprite bounds for a tall actor', () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const sprite = new Sprite();
    // Актор в клетке (0,0): якорь снизу по центру, масштаб 1.5.
    sprite.x = 16;
    sprite.y = 27.2;
    sprite.width = 32;
    sprite.height = 48;
    sprite.anchor.x = 0.5;
    sprite.anchor.y = 1;

    const sprites = new Map<string, Sprite>();
    sprites.set('player', sprite);

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');
    const scale = 32 / 80; // TILE_SIZE / BASE_WIDTH

    const spriteTop = sprite.y - sprite.height * sprite.anchor.y;
    // Виджет шириной BASE_WIDTH масштабируется до TILE_SIZE, поэтому его
    // горизонтальный центр совпадает с центром спрайта.
    const halfWidgetWidth = (80 * scale) / 2;
    expect(widget.container.x).toBeCloseTo(sprite.x - halfWidgetWidth);
    expect(widget.container.y).toBeCloseTo(
      spriteTop - widget.contentHeight * scale - 1,
    );
    expect(widget.container.y).toBeLessThan(spriteTop);
  });

  it('centers widget horizontally over a top-left anchored sprite', () => {
    const renderer = new UnitInfoRenderer();
    const input = makeRenderInput(false);
    const sprite = new Sprite();
    sprite.x = 64;
    sprite.y = 32;
    sprite.width = 40;
    sprite.height = 40;
    sprite.anchor.x = 0;
    sprite.anchor.y = 0;

    const sprites = new Map<string, Sprite>();
    sprites.set('player', sprite);

    renderer.update(input, (id) => sprites.get(id));
    const widget = (renderer as any).widgets.get('player');
    const scale = 32 / 80;

    const spriteCenterX = sprite.x + sprite.width * 0.5;
    const halfWidgetWidth = (80 * scale) / 2;
    expect(widget.container.x).toBeCloseTo(spriteCenterX - halfWidgetWidth);
    expect(widget.container.y).toBeCloseTo(
      sprite.y - widget.contentHeight * scale - 1,
    );
  });
});
