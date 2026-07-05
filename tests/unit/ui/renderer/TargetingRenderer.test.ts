/**
 * Unit tests for TargetingRenderer.
 */

import {describe, expect, it, vi} from 'vitest';

vi.mock('pixi.js', () => {
  class MockTexture {
    static EMPTY = new MockTexture();
  }
  class MockTextStyle {
    constructor(_style?: unknown) {}
  }
  class MockText {
    x = 0;
    y = 0;
    anchor = {set() {}};
    roundPixels = false;
    resolution = 1;
    constructor(_opts?: unknown) {}
    destroy() {}
  }
  class MockGraphics {
    x = 0;
    y = 0;
    visible = true;
    scale = {x: 1, y: 1};
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }
    circle() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    destroy() {}
  }
  class MockContainer {
    children: any[] = [];
    addChild(c: any) { this.children.push(c); return c; }
    removeChildren() { this.children = []; }
    destroy() {}
  }
  return {
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    TextStyle: MockTextStyle,
    Texture: MockTexture,
  };
});

import {TargetingRenderer} from '../../../../src/ui/renderer/TargetingRenderer';
import type {RenderInput} from '../../../../src/presentation/types';

function makeRenderInput(
  overlay: RenderInput['targetingOverlay'],
  aiPreparedIntents: RenderInput['aiPreparedIntents'],
  highlightedPathTurnEndIndices: number[] = [],
): RenderInput {
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
      player: {
        id: 'player',
        type: 'player',
        displayName: 'Герой',
        templateId: 'witcher',
        x: 0,
        y: 0,
        blocksMovement: true,
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
        baseStats: {str: 0, dex: 0, int: 0, vit: 0},
        statModifiers: [],
        dodgeChance: 0,
        accuracy: 0,
        critChance: 0,
        critMultiplier: 1.5,
        statusEffects: [],
        abilities: [],
        factionId: 'player' as const,
      },
      visible: [],
      explored: [],
      turn: {activeSide: 'player' as const, round: 1},
      phase: 'playing' as const,
      floor: 1,
      floorSnapshots: [],
      rng: {seed: 1, state: 1},
      nextEntityCounter: 0,
      runStats: {startTime: Date.now(), enemiesKilled: 0, chestsOpened: 0, itemsPickedUp: 0},
    },
    highlightedPath: null,
    highlightedPathCommitted: false,
    highlightedPathTargetKind: 'none',
    highlightedPathTurnEndIndices,
    doorSprites: new Map(),
    animations: null,
    phase: 'idle' as const,
    zoom: 1,
    playerStats: {
      level: 1,
      xp: 0,
      hp: 10,
      maxHp: 10,
      ap: 3,
      maxAp: 3,
      baseStats: {str: 0, dex: 0, int: 0, vit: 0},
      effectiveStats: {str: 0, dex: 0, int: 0, vit: 0},
      damage: 2,
      armor: 0,
      dodgeChance: 0,
      accuracy: 0,
      critChance: 0,
      critMultiplier: 1.5,
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
    targetingOverlay: overlay,
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
    runStats: {startTime: Date.now(), enemiesKilled: 0, chestsOpened: 0, itemsPickedUp: 0},
    fieldObjectPopover: null,
    interactionHint: null,
    aiPreparedIntents,
    currentTurnSide: 'player',
    debugEnabled: false,
    mapgenDebugEnabled: false,
  };
}

describe('TargetingRenderer', () => {
  it('renders AI prepared intents even when player targeting overlay is null', () => {
    const renderer = new TargetingRenderer();
    const input = makeRenderInput(null, [
      {
        entityId: 'enemy1',
        abilityId: 'fireball',
        name: 'Fireball',
        icon: null,
        fixedTargets: [{x: 5, y: 5}],
        affectedPositions: [
          {x: 4, y: 4}, {x: 5, y: 4}, {x: 6, y: 4},
          {x: 4, y: 5}, {x: 5, y: 5}, {x: 6, y: 5},
          {x: 4, y: 6}, {x: 5, y: 6}, {x: 6, y: 6},
        ],
        intents: [],
      },
    ]);

    renderer.update(input);

    expect(renderer.overlayContainer.children.length).toBe(9);
  });

  it('renders player targeting overlays together with AI prepared intents', () => {
    const renderer = new TargetingRenderer();
    const input = makeRenderInput(
      {
        valid: [{x: 1, y: 1}],
        hover: null,
        affected: [],
        selected: [],
        previewIntents: [],
      },
      [
        {
          entityId: 'enemy1',
          abilityId: 'fireball',
          name: 'Fireball',
          icon: null,
          fixedTargets: [{x: 5, y: 5}],
          affectedPositions: [{x: 5, y: 5}, {x: 6, y: 5}],
          intents: [],
        },
      ],
    );

    renderer.update(input);

    // 1 overlay from player targeting + 2 overlays from AI prepared intents
    expect(renderer.overlayContainer.children.length).toBe(3);
  });

  it('renders AI movement intents as arrows even without player targeting', () => {
    const renderer = new TargetingRenderer();
    const input = makeRenderInput(null, [
      {
        entityId: 'enemy1',
        abilityId: 'dash',
        name: 'Dash',
        icon: null,
        fixedTargets: [{x: 2, y: 0}],
        affectedPositions: [],
        intents: [
          {
            type: 'MOVE',
            entityId: 'enemy1',
            dx: 2,
            dy: 0,
            from: {x: 0, y: 0},
            to: {x: 2, y: 0},
          },
        ],
      },
    ]);

    renderer.update(input);

    // One arrow for the AI movement intent
    expect(renderer.previewContainer.children.length).toBe(1);
  });

  describe('autopath visualization', () => {
    it('renders only the last tile of the path, but draws a path line', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, [], [2]);
      input.highlightedPath = [{x: 1, y: 0}, {x: 2, y: 0}, {x: 3, y: 0}];
      input.highlightedPathCommitted = false;
      input.highlightedPathTargetKind = 'move';

      renderer.update(input);

      // Контур последнего тайла + линия пути + отметка конца хода на тайле (3,0).
      expect(renderer.overlayContainer.children.length).toBe(3);
    });

    it('does not highlight intermediate tiles', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, [], [2]);
      input.highlightedPath = [{x: 1, y: 0}, {x: 2, y: 0}, {x: 3, y: 0}];
      input.highlightedPathCommitted = true;
      input.highlightedPathTargetKind = 'move';

      renderer.update(input);

      // Контур последнего тайла + линия + отметка конца хода.
      expect(renderer.overlayContainer.children.length).toBe(3);
    });

    it('renders preview path in white', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, []);
      input.highlightedPath = [{x: 1, y: 0}];
      input.highlightedPathCommitted = false;
      input.highlightedPathTargetKind = 'move';

      renderer.update(input);

      // 1 overlay (последний тайл) + 1 линия пути.
      expect(renderer.overlayContainer.children.length).toBe(2);
    });

    it('renders committed enemy path in red', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, []);
      input.highlightedPath = [{x: 1, y: 0}];
      input.highlightedPathCommitted = true;
      input.highlightedPathTargetKind = 'enemy';

      renderer.update(input);

      expect(renderer.overlayContainer.children.length).toBe(2);
    });

    it('renders committed interactable/move path in green', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, []);
      input.highlightedPath = [{x: 1, y: 0}];
      input.highlightedPathCommitted = true;
      input.highlightedPathTargetKind = 'interactable';

      renderer.update(input);

      expect(renderer.overlayContainer.children.length).toBe(2);
    });

    it('renders turn-end marker when path reaches current AP limit', () => {
      const renderer = new TargetingRenderer();
      // maxAp=3, ap=3 → отметка на 3-м шаге (индекс 2).
      const input = makeRenderInput(null, [], [2]);
      input.highlightedPath = [{x: 1, y: 0}, {x: 2, y: 0}, {x: 3, y: 0}];
      input.highlightedPathCommitted = false;
      input.highlightedPathTargetKind = 'move';

      renderer.update(input);

      // Контур + линия + 1 отметка конца хода.
      expect(renderer.overlayContainer.children.length).toBe(3);
    });

    it('renders multiple turn-end markers for long paths', () => {
      const renderer = new TargetingRenderer();
      // maxAp=3, ap=3 → отметки на индексах 2 и 5.
      const input = makeRenderInput(null, [], [2, 5]);
      input.highlightedPath = [
        {x: 1, y: 0}, {x: 2, y: 0}, {x: 3, y: 0},
        {x: 4, y: 0}, {x: 5, y: 0}, {x: 6, y: 0},
      ];
      input.highlightedPathCommitted = false;
      input.highlightedPathTargetKind = 'move';

      renderer.update(input);

      // Контур + линия + 2 отметки конца хода.
      expect(renderer.overlayContainer.children.length).toBe(4);
    });

    it('does not render turn-end marker when path is shorter than remaining AP', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, []);
      // maxAp=3, ap=3, путь длиной 1 — отметка не нужна.
      input.highlightedPath = [{x: 1, y: 0}];
      input.highlightedPathCommitted = false;
      input.highlightedPathTargetKind = 'move';

      renderer.update(input);

      expect(renderer.overlayContainer.children.length).toBe(2);
    });

    it('renders turn-end markers starting from next turn when current AP is zero', () => {
      const renderer = new TargetingRenderer();
      // ap=0 → первый ход начнётся со следующего turn'а: отметки на индексах 2 и 5.
      const input = makeRenderInput(null, [], [2, 5]);
      input.playerStats.ap = 0;
      input.playerStats.maxAp = 3;
      input.highlightedPath = [
        {x: 1, y: 0}, {x: 2, y: 0}, {x: 3, y: 0},
        {x: 4, y: 0}, {x: 5, y: 0}, {x: 6, y: 0},
      ];
      input.highlightedPathCommitted = false;
      input.highlightedPathTargetKind = 'move';

      renderer.update(input);

      // Контур + линия + 2 отметки конца хода.
      expect(renderer.overlayContainer.children.length).toBe(4);
    });
  });
});
