/**
 * Unit tests for TileEffectStatusRenderer.
 */

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Container} from 'pixi.js';
import type {RenderInput} from '@presentation/types.ts';
import type {DisplayState} from '@presentation/displayState/types.ts';
import {TILE_HEIGHT, TILE_SIZE,} from '@utils/constants.ts';
import {
  BURNING_CLUSTER_PADDING_X,
  BURNING_CLUSTER_SCALE_MAX,
  BURNING_CLUSTER_SCALE_MIN,
  BURNING_CLUSTER_SWAY_AMPLITUDE,
  BURNING_CLUSTER_VERTICAL_MAX,
  BURNING_CLUSTER_VERTICAL_MIN,
} from '@ui/renderer/tileEffectStatusStrategies/burningClusterStrategy.ts';
import {TileEffectStatusRenderer} from '../../../../src/ui/renderer/TileEffectStatusRenderer';

vi.mock('pixi.js', () => {
  class MockTexture {
    static EMPTY = new MockTexture();
  }
  class MockSprite {
    x = 0;
    y = 0;
    alpha = 1;
    visible = true;
    width = 0;
    height = 0;
    texture = MockTexture.EMPTY;
    zIndex = 0;
    anchor = {
      x: 0,
      y: 0,
      set(ax: number, ay: number) {
        this.x = ax;
        this.y = ay;
      },
    };
    scale = { x: 1, y: 1, set() {} };
    parent: MockContainer | null = null;
    destroy() {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((child) => child !== this);
        this.parent = null;
      }
    }
  }
  class MockContainer {
    children: any[] = [];
    sortableChildren = false;
    x = 0;
    y = 0;
    scale = { x: 1, y: 1, set() {} };
    addChild(c: any) {
      c.parent = this;
      this.children.push(c);
      return c;
    }
    removeChildren() { this.children = []; }
    destroy() {}
  }
  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: MockTexture,
  };
});

vi.mock('../../../../src/ui/renderer/TextureCache', () => ({
  getTextureSync: vi.fn(() => undefined),
  getTexture: vi.fn(() => Promise.resolve({} as any)),
}));

function makeDisplayState(overrides?: Partial<DisplayState>): DisplayState {
  const tiles = Array.from({length: 10}, () =>
    Array.from({length: 10}, () => ({type: 'floor' as const})),
  );
  return {
    map: {
      width: 10,
      height: 10,
      tiles,
      visible: Array.from({length: 10}, () => Array(10).fill(true)),
      explored: Array.from({length: 10}, () => Array(10).fill(true)),
    },
    entities: new Map(),
    player: {
      id: 'player',
      type: 'player',
      x: 0,
      y: 0,
      templateId: 'witcher',
    },
    meta: {
      floor: 1,
      round: 1,
      turnSide: 'player',
      phase: 'playing',
    },
    ...overrides,
  };
}

function makeRenderInput(displayState: DisplayState): RenderInput {
  return {
    state: {} as RenderInput['state'],
    displayState,
    highlightedPath: null,
    highlightedPathCommitted: false,
    highlightedPathTargetKind: 'none',
    highlightedPathTurnEndIndices: [],
    objectSprites: new Map(),
    animations: null,
    phase: 'idle',
    zoom: 1,
    playerStats: {} as RenderInput['playerStats'],
    equipment: {} as RenderInput['equipment'],
    targetingOverlay: null,
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
    runStats: {} as RenderInput['runStats'],
    fieldObjectPopover: null,
    interactionHint: null,
    aiPreparedIntents: [],
    currentTurnSide: 'player',
    debugEnabled: false,
    mapgenDebugEnabled: false,
    pendingWindow: null,
    animationBatchId: 0,
  };
}

describe('TileEffectStatusRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a cluster for burning status and ignores material effects', () => {
    const displayState = makeDisplayState();
    displayState.map.tiles[2]![2]!.tileEffects = [
      {type: 'oil', kind: 'effect', layer: 'cover', renderOrder: 1},
      {type: 'burning', kind: 'status', layer: 'cover', renderOrder: 2},
    ];

    const parent = new Container();
    const renderer = new TileEffectStatusRenderer(parent as any);
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);

    expect(parent.children.length).toBeGreaterThanOrEqual(3);
    expect(parent.children.length).toBeLessThanOrEqual(5);
  });

  it('creates a single sprite for non-cluster statuses', () => {
    const displayState = makeDisplayState();
    displayState.map.tiles[2]![2]!.tileEffects = [
      {type: 'frozen', kind: 'status', layer: 'cover', renderOrder: 1},
    ];

    const parent = new Container();
    const renderer = new TileEffectStatusRenderer(parent as any);
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);

    expect(parent.children.length).toBe(1);
  });

  it('positions single status sprite like an actor with bottom-center anchor', () => {
    const displayState = makeDisplayState();
    // tiles[y][x]
    displayState.map.tiles[4]![3]!.tileEffects = [
      {type: 'frozen', kind: 'status', layer: 'cover', renderOrder: 2},
    ];

    const parent = new Container();
    const renderer = new TileEffectStatusRenderer(parent as any);
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);

    const sprite = parent.children[0]! as any;
    expect(sprite.anchor.x).toBe(0.5);
    expect(sprite.anchor.y).toBe(1);
    expect(sprite.x).toBe(3 * TILE_SIZE + TILE_SIZE / 2);
    // Дефолт категории tileEffectStatus: масштаб 0.7, низ значка на 0.5 высоты сжатой клетки.
    expect(sprite.y).toBe(4 * TILE_HEIGHT + TILE_HEIGHT * 0.5);
    expect(sprite.width).toBe(TILE_SIZE * 0.7);
    expect(sprite.height).toBe(TILE_SIZE * 0.7);
    expect(sprite.zIndex).toBe(sprite.y);
  });

  it('positions burning cluster sprites inside the tile with correct anchor and scale', () => {
    const displayState = makeDisplayState();
    // tiles[y][x]
    displayState.map.tiles[4]![3]!.tileEffects = [
      {type: 'burning', kind: 'status', layer: 'cover', renderOrder: 1},
    ];

    const parent = new Container();
    const renderer = new TileEffectStatusRenderer(parent as any);
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);

    const baseX = 3 * TILE_SIZE;
    const baseY = 4 * TILE_HEIGHT;
    for (const child of parent.children) {
      const sprite = child as any;
      expect(sprite.anchor.x).toBe(0.5);
      expect(sprite.anchor.y).toBe(1);
      expect(sprite.x).toBeGreaterThanOrEqual(baseX + BURNING_CLUSTER_PADDING_X);
      expect(sprite.x).toBeLessThanOrEqual(baseX + TILE_SIZE - BURNING_CLUSTER_PADDING_X);
      expect(sprite.y).toBeGreaterThanOrEqual(baseY + TILE_HEIGHT * BURNING_CLUSTER_VERTICAL_MIN);
      expect(sprite.y).toBeLessThanOrEqual(baseY + TILE_HEIGHT * BURNING_CLUSTER_VERTICAL_MAX);
      expect(sprite.width).toBeGreaterThanOrEqual(TILE_SIZE * BURNING_CLUSTER_SCALE_MIN);
      expect(sprite.width).toBeLessThanOrEqual(TILE_SIZE * BURNING_CLUSTER_SCALE_MAX);
      expect(sprite.height).toBe(sprite.width);
      expect(sprite.zIndex).toBe(sprite.y);
    }
  });

  it('sways burning cluster sprites left and right over time', () => {
    const displayState = makeDisplayState();
    displayState.map.tiles[2]![2]!.tileEffects = [
      {type: 'burning', kind: 'status', layer: 'cover', renderOrder: 1},
    ];

    const parent = new Container();
    const renderer = new TileEffectStatusRenderer(parent as any);
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);
    expect(parent.children.length).toBeGreaterThan(0);

    const initialXs = parent.children.map((s) => (s as any).x);
    renderer.updateAnimations(1000);
    const nextXs = parent.children.map((s) => (s as any).x);

    for (let i = 0; i < initialXs.length; i++) {
      expect(nextXs[i]).not.toBe(initialXs[i]);
      expect(Math.abs((nextXs[i] as number) - (initialXs[i] as number))).toBeLessThanOrEqual(BURNING_CLUSTER_SWAY_AMPLITUDE + 0.001);
    }
  });

  it('does not render status sprites on cells outside FOV', () => {
    const displayState = makeDisplayState();
    displayState.map.visible = Array.from({length: 10}, () => Array(10).fill(false));
    displayState.map.tiles[2]![2]!.tileEffects = [
      {type: 'frozen', kind: 'status', layer: 'cover', renderOrder: 1},
    ];

    const parent = new Container();
    const renderer = new TileEffectStatusRenderer(parent as any);
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);

    expect(parent.children.length).toBe(0);
  });

  it('renders status sprites on non-visible cells when debug is enabled', () => {
    const displayState = makeDisplayState();
    displayState.map.visible = Array.from({length: 10}, () => Array(10).fill(false));
    displayState.map.tiles[2]![2]!.tileEffects = [
      {type: 'burning', kind: 'status', layer: 'cover', renderOrder: 1},
    ];

    const input = makeRenderInput(displayState);
    input.debugEnabled = true;

    const parent = new Container();
    const renderer = new TileEffectStatusRenderer(parent as any);
    renderer.update(input, 0, 0, 320, 320);

    expect(parent.children.length).toBeGreaterThan(0);
  });

  it('destroys sprites when status overlay is removed', () => {
    const displayState = makeDisplayState();
    displayState.map.tiles[2]![2]!.tileEffects = [
      {type: 'burning', kind: 'status', layer: 'cover', renderOrder: 1},
    ];

    const parent = new Container();
    const renderer = new TileEffectStatusRenderer(parent as any);
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);
    const before = parent.children.length;
    expect(before).toBeGreaterThan(0);

    displayState.map.tiles[2]![2]!.tileEffects = [
      {type: 'oil', kind: 'effect', layer: 'cover', renderOrder: 1},
    ];
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);

    expect(parent.children.length).toBe(0);
  });
});
