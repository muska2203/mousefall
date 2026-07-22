/**
 * Unit tests for TileEffectRenderer overlay management.
 */

import {describe, expect, it, vi, beforeEach} from 'vitest';
import type {RenderInput} from '../../../../src/presentation/types';
import type {DisplayState} from '../../../../src/presentation/displayState/types';

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
    anchor = { set() {} };
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

import {TileEffectRenderer} from '../../../../src/ui/renderer/TileEffectRenderer';

const TILE_SIZE = 32;

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
    doorSprites: new Map(),
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
    animationBatchId: 0,
  };
}

describe('TileEffectRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates multiple sprites for tile with multiple overlays', () => {
    const displayState = makeDisplayState();
    displayState.map.tiles[2]![2]!.tileEffects = [
      {type: 'oil', renderOrder: 1},
      {type: 'burning', renderOrder: 2},
    ];

    const renderer = new TileEffectRenderer();
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);

    expect(renderer.container.children.length).toBe(2);
    // Оба спрайта должны быть на координатах тайла (2, 2).
    expect(renderer.container.children.every((s) => s.x === 2 * TILE_SIZE && s.y === 2 * TILE_SIZE)).toBe(true);
  });

  it('sorts sprites by renderOrder via zIndex', () => {
    const displayState = makeDisplayState();
    displayState.map.tiles[2]![2]!.tileEffects = [
      {type: 'burning', renderOrder: 5},
      {type: 'oil', renderOrder: 1},
    ];

    const renderer = new TileEffectRenderer();
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);

    const children = renderer.container.children;
    expect(children.some((s) => s.zIndex === 1)).toBe(true); // oil
    expect(children.some((s) => s.zIndex === 5)).toBe(true); // burning
  });

  it('destroys sprites when overlay is removed', () => {
    const displayState = makeDisplayState();
    displayState.map.tiles[2]![2]!.tileEffects = [
      {type: 'oil', renderOrder: 1},
      {type: 'burning', renderOrder: 2},
    ];

    const renderer = new TileEffectRenderer();
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);

    expect(renderer.container.children.length).toBe(2);

    // Убираем статус горения — спрайт огня должен быть уничтожен.
    displayState.map.tiles[2]![2]!.tileEffects = [{type: 'oil', renderOrder: 1}];
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);

    expect(renderer.container.children.length).toBe(1);
  });

  it('updates zIndex when overlay renderOrder changes', () => {
    const displayState = makeDisplayState();
    displayState.map.tiles[2]![2]!.tileEffects = [{type: 'oil', renderOrder: 1}];

    const renderer = new TileEffectRenderer();
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);
    expect(renderer.container.children[0]!.zIndex).toBe(1);

    // Меняем renderOrder — у существующего спрайта должен обновиться zIndex.
    displayState.map.tiles[2]![2]!.tileEffects = [{type: 'oil', renderOrder: 5}];
    renderer.update(makeRenderInput(displayState), 0, 0, 320, 320);
    expect(renderer.container.children[0]!.zIndex).toBe(5);
  });
});
