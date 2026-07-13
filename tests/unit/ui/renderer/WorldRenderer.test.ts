/**
 * Unit tests for WorldRenderer camera behavior.
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
    x = 0;
    y = 0;
    scale = { x: 1, y: 1, set(x: number, y?: number) { (this as any).x = x; (this as any).y = y ?? x; } };
    addChild(c: any) { this.children.push(c); return c; }
    removeChildren() { this.children = []; }
    destroy() {}
  }
  class MockGraphics {
    x = 0;
    y = 0;
    visible = true;
    scale = { x: 1, y: 1 };
    clear() { return this; }
    circle() { return this; }
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }
    destroy() {}
  }
  class MockText {
    x = 0;
    y = 0;
    visible = true;
    anchor = { set() {} };
    style = {};
    destroy() {}
  }
  class MockTicker {
    callbacks: (() => void)[] = [];
    add(fn: () => void) { this.callbacks.push(fn); }
    remove(fn: () => void) { const i = this.callbacks.indexOf(fn); if (i >= 0) this.callbacks.splice(i, 1); }
  }
  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: MockTexture,
    Graphics: MockGraphics,
    Text: MockText,
    Ticker: MockTicker,
  };
});

import {WorldRenderer} from '../../../../src/ui/renderer/WorldRenderer';
import {ANIMATION_CONFIG} from '../../../../src/utils/animationConfig';
import type {RenderInput} from '../../../../src/presentation/types';

const TILE_SIZE = 32;

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
    activeRules: [],
    factionId: 'player' as const,
    ...playerOverrides,
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
      visible: visible ?? Array.from({length: 10}, () => Array(10).fill(true)),
      explored: visible ?? Array.from({length: 10}, () => Array(10).fill(true)),
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
      featureFlags: {
        contentRulesEnabled: false,
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
    debugEnabled: false,
    mapgenDebugEnabled: false,
  };
}

describe('WorldRenderer camera', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    resetRegistry();
  });

  it('seeds camera at move start before animation begins', () => {
    const renderer = new WorldRenderer(800, 600);
    const input = makeRenderInput();
    input.state.player.x = 1;
    input.state.player.y = 0;
    input.animations = [
      {
        side: 'player',
        nodes: [
          {
            step: {type: 'MOVE', entityId: 'player', from: {x: 0, y: 0}, to: {x: 1, y: 0}},
            children: [],
          },
        ],
      },
    ];

    renderer.render(input);

    // Камера должна быть у начальной клетки (0,0), а не у конечной (1,0)
    const expectedFromX = -(0 * TILE_SIZE + TILE_SIZE / 2 - 800 / 2);
    expect(renderer.root.x).toBe(expectedFromX);
  });

  it('does not snap camera back to move start after camera animation finishes', async () => {
    const renderer = new WorldRenderer(800, 600);
    const input = makeRenderInput();
    input.state.player.x = 1;
    input.state.player.y = 0;
    input.animations = [
      {
        side: 'player',
        nodes: [
          {
            step: {type: 'MOVE', entityId: 'player', from: {x: 0, y: 0}, to: {x: 1, y: 0}},
            children: [],
          },
        ],
      },
    ];

    renderer.render(input);

    const cameraPromise = (renderer as any).animateCamera(
      {x: 0, y: 0},
      {x: 1, y: 0},
      ANIMATION_CONFIG.MOVE,
    );

    // Завершаем анимацию камеры
    (renderer as any).updateCamera(performance.now() + ANIMATION_CONFIG.MOVE.duration + 10);
    await cameraPromise;

    const expectedToX = -(1 * TILE_SIZE + TILE_SIZE / 2 - 800 / 2);
    expect(renderer.root.x).toBe(expectedToX);

    // Повторный render() (например, из-за hover/resize во время анимации врага)
    // не должен телепортировать камеру обратно к (0,0)
    renderer.render(input);
    expect(renderer.root.x).toBe(expectedToX);
  });

  it('resets camera base when animation batch is cleared', () => {
    const renderer = new WorldRenderer(800, 600);
    const input = makeRenderInput();
    input.state.player.x = 2;
    input.state.player.y = 0;
    input.animations = [
      {
        side: 'player',
        nodes: [
          {
            step: {type: 'MOVE', entityId: 'player', from: {x: 1, y: 0}, to: {x: 2, y: 0}},
            children: [],
          },
        ],
      },
    ];

    renderer.render(input);
    expect((renderer as any).cameraBase).toEqual({x: 1, y: 0});

    input.animations = null;
    renderer.render(input);
    expect((renderer as any).cameraBase).toBeNull();
  });

  it('applies current zoom to camera position during animation', async () => {
    const renderer = new WorldRenderer(800, 600);
    const input = makeRenderInput();
    input.state.player.x = 1;
    input.state.player.y = 0;
    input.zoom = 2;
    input.animations = [
      {
        side: 'player',
        nodes: [
          {
            step: {type: 'MOVE', entityId: 'player', from: {x: 0, y: 0}, to: {x: 1, y: 0}},
            children: [],
          },
        ],
      },
    ];

    renderer.render(input);

    (renderer as any).animateCamera(
      {x: 0, y: 0},
      {x: 1, y: 0},
      ANIMATION_CONFIG.MOVE,
    );

    // Промежуточное обновление на полпути
    (renderer as any).updateCamera(performance.now() + ANIMATION_CONFIG.MOVE.duration / 2);

    // Мировая позиция камеры должна лежать между from и to
    const scale = renderer.root.scale.x;
    const worldCameraX = -renderer.root.x / scale;
    const fromWorldX = 0 * TILE_SIZE + TILE_SIZE / 2 - 800 / scale / 2;
    const toWorldX = 1 * TILE_SIZE + TILE_SIZE / 2 - 800 / scale / 2;
    expect(worldCameraX).toBeGreaterThan(Math.min(fromWorldX, toWorldX));
    expect(worldCameraX).toBeLessThan(Math.max(fromWorldX, toWorldX));
  });

  it('screenToWorld uses current camera position during animation', async () => {
    const renderer = new WorldRenderer(64, 64);
    const input = makeRenderInput();
    input.state.player.x = 1;
    input.state.player.y = 0;
    input.animations = [
      {
        side: 'player',
        nodes: [
          {
            step: {type: 'MOVE', entityId: 'player', from: {x: 0, y: 0}, to: {x: 1, y: 0}},
            children: [],
          },
        ],
      },
    ];

    renderer.render(input);

    (renderer as any).animateCamera(
      {x: 0, y: 0},
      {x: 1, y: 0},
      ANIMATION_CONFIG.MOVE,
    );

    // Центр viewport: в начале анимации под ним тайл (0,0),
    // в конце — тайл (1,0).
    const screenPos = {x: 32, y: 32};

    // На старте камера у начальной клетки.
    const startTile = renderer.screenToWorld(screenPos.x, screenPos.y);
    expect(startTile).toEqual({x: 0, y: 0});

    // Промежуточное обновление: камера сдвинулась, под тем же экранным пикселем
    // теперь другой тайл.
    (renderer as any).updateCamera(performance.now() + ANIMATION_CONFIG.MOVE.duration / 2);
    const midTile = renderer.screenToWorld(screenPos.x, screenPos.y);
    expect(midTile).toEqual({x: 1, y: 0});

    // После завершения камера у конечной клетки.
    (renderer as any).updateCamera(performance.now() + ANIMATION_CONFIG.MOVE.duration + 10);
    const endTile = renderer.screenToWorld(screenPos.x, screenPos.y);
    expect(endTile).toEqual({x: 1, y: 0});
  });
});
