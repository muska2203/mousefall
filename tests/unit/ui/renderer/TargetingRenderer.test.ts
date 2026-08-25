/**
 * Unit tests for TargetingRenderer.
 */

import {describe, expect, it, vi} from 'vitest';
import {TargetingRenderer} from '../../../../src/ui/renderer/TargetingRenderer';
import type {RenderInput} from '../../../../src/presentation/types';
import {buildDisplayState} from '../../../../src/presentation/displayState/builder';
import type {GameState} from '../../../../src/simulation/types';

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
    moves: Array<{x: number; y: number}> = [];
    lines: Array<{x: number; y: number}> = [];
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }
    circle() { return this; }
    moveTo(x: number, y: number) { this.moves.push({x, y}); return this; }
    lineTo(x: number, y: number) { this.lines.push({x, y}); return this; }
    clear() { this.moves = []; this.lines = []; return this; }
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

function makeRenderInput(
  overlay: RenderInput['targetingOverlay'],
  aiPreparedIntents: RenderInput['aiPreparedIntents'],
  highlightedPathTurnEndIndices: number[] = [],
): RenderInput {
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
      finalFloor: 10,
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
      baseStats: {str: 0, dex: 0, int: 0, vit: 0},
      statModifiers: [],
      critMultiplier: 1.5,
      statusEffects: [],
      abilities: [],
      activeRules: [],
      relics: [],
      factionId: 'player' as const,
    },
    visible: [],
    explored: [],
    turn: {activeSide: 'player' as const, round: 1},
    phase: 'playing' as const,
    floor: 1,
    floorSnapshots: [],
    rng: {seed: 1, state: 1},
    runtimeRng: {seed: 1, state: 1},
    nextEntityCounter: 0,
    runStats: {startTime: Date.now(), enemiesKilled: 0, chestsOpened: 0, itemsPickedUp: 0, defeatedBossIds: []},
    featureFlags: {contentRulesEnabled: false},
  };

  return {
    state,
    displayState: buildDisplayState(state),
    highlightedPath: null,
    highlightedPathCommitted: false,
    highlightedPathTargetKind: 'none',
    highlightedPathTurnEndIndices,
    objectSprites: new Map(),
    animations: null,
    phase: 'idle' as const,
    zoom: 1,
    playerStats: {
      hp: 10,
      maxHp: 10,
      ap: 3,
      maxAp: 3,
      baseStats: {str: 0, dex: 0, int: 0, vit: 0},
      effectiveStats: {str: 0, dex: 0, int: 0, vit: 0},
      damage: { min: 2, max: 2 },
      armor: 0,
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
    relics: [],
    hotbar: [],
    activeEffects: [],
    statusEffectsByEntity: new Map(),
    aiModeByEntity: new Map(),
    runStats: {startTime: Date.now(), enemiesKilled: 0, chestsOpened: 0, itemsPickedUp: 0, defeatedBossIds: []},
    fieldObjectPopover: null,
    interactionHint: null,
    aiPreparedIntents,
    currentTurnSide: 'player',
    debugEnabled: false,
    mapgenDebugEnabled: false,
    pendingWindow: null,
    enemyHoverOverlay: null,
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

  describe('skill hover cast line', () => {
    it('draws a dashed line from player to hovered valid target', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(
        {
          valid: [{x: 1, y: 1}],
          hover: {x: 1, y: 1},
          affected: [],
          selected: [],
          previewIntents: [],
        },
        [],
      );

      renderer.update(input);

      // Подсветка валидной клетки + подсветка hover-клетки + пунктирная линия.
      expect(renderer.overlayContainer.children.length).toBe(3);
    });

    it('does not draw the line when hovered cell is not a valid target', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(
        {
          valid: [{x: 1, y: 1}],
          hover: {x: 2, y: 2},
          affected: [],
          selected: [],
          previewIntents: [],
        },
        [],
      );

      renderer.update(input);

      // Подсветка валидной клетки + подсветка hover-клетки, без линии.
      expect(renderer.overlayContainer.children.length).toBe(2);
    });

    it('does not draw the line without hover', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(
        {
          valid: [{x: 1, y: 1}],
          hover: null,
          affected: [],
          selected: [],
          previewIntents: [],
        },
        [],
      );

      renderer.update(input);

      expect(renderer.overlayContainer.children.length).toBe(1);
    });

    it('ends the dashed line exactly at the hovered cell center', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(
        {
          valid: [{x: 2, y: 0}],
          hover: {x: 2, y: 0},
          affected: [],
          selected: [],
          previewIntents: [],
        },
        [],
      );

      renderer.update(input);

      // Игрок стоит на (0,0): центр (16, 14.4); цель (2,0): центр (80, 14.4).
      const line = renderer.overlayContainer.children.find(
        (c: any) => c.lines?.length > 0,
      ) as any;
      expect(line).toBeDefined();
      const last = line.lines[line.lines.length - 1];
      expect(last.x).toBeCloseTo(80, 5);
      expect(last.y).toBeCloseTo(14.4, 5);
      // Ни одна точка линии не выходит за пределы сегмента.
      for (const p of line.lines) {
        expect(p.x).toBeLessThanOrEqual(80 + 1e-9);
        expect(p.x).toBeGreaterThanOrEqual(16 - 1e-9);
        expect(p.y).toBeCloseTo(14.4, 5);
      }
    });
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

    it('path line start follows updatePathStart (ticker-driven)', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, []);
      input.highlightedPath = [{x: 1, y: 0}];
      input.highlightedPathCommitted = false;
      input.highlightedPathTargetKind = 'move';

      renderer.update(input, {x: 16, y: 14.4});

      const line = renderer.overlayContainer.children.find(
        (c: any) => c.lines?.length > 0,
      ) as any;
      expect(line).toBeDefined();
      expect(line.moves[0].x).toBeCloseTo(16, 5);
      expect(line.moves[0].y).toBeCloseTo(14.4, 5);

      // Покадровое обновление: персонаж сместился — линия перерисовывается
      // от новой точки в том же Graphics, без создания новых объектов.
      renderer.updatePathStart({x: 40, y: 14.4});
      expect(line.moves[0].x).toBeCloseTo(40, 5);
      expect(line.moves[0].y).toBeCloseTo(14.4, 5);
      expect(
        renderer.overlayContainer.children.filter((c: any) => c.lines?.length > 0).length,
      ).toBe(1);
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

  describe('enemy hover overlay (attack preparation)', () => {
    it('renders range cells, target highlight and dashed line to the target', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, []);
      input.enemyHoverOverlay = {
        rangeCells: [{x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}],
        target: {x: 2, y: 0},
        inRange: true,
        attackOrigin: null,
      };

      renderer.update(input);

      // 3 клетки зоны + подсветка клетки цели + пунктирная линия.
      expect(renderer.overlayContainer.children.length).toBe(5);
    });

    it('ends the dashed line exactly at the target cell center', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, []);
      input.enemyHoverOverlay = {
        rangeCells: [],
        target: {x: 2, y: 0},
        inRange: false,
        attackOrigin: null,
      };

      renderer.update(input);

      // Подсветка цели + линия; игрок стоит на (0,0): центр (16, 14.4);
      // цель (2,0): центр (80, 14.4).
      const line = renderer.overlayContainer.children.find(
        (c: any) => c.lines?.length > 0,
      ) as any;
      expect(line).toBeDefined();
      const last = line.lines[line.lines.length - 1];
      expect(last.x).toBeCloseTo(80, 5);
      expect(last.y).toBeCloseTo(14.4, 5);
    });

    it('starts the dashed line from attackOrigin when it is set (attack cell)', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, []);
      input.enemyHoverOverlay = {
        rangeCells: [],
        target: {x: 2, y: 0},
        inRange: false,
        // Presentation вычислил атакующую клетку (1,0) — соседнюю с целью.
        attackOrigin: {x: 1, y: 0},
      };

      renderer.update(input);

      // Линия к цели идёт от центра attackOrigin (1,0) → (48, 14.4),
      // а не от персонажа (0,0) → (16, 14.4).
      const lines = renderer.overlayContainer.children.filter(
        (c: any) => c.lines?.length > 0,
      ) as any[];
      const line = lines.find((c) => {
        const last = c.lines[c.lines.length - 1];
        return Math.abs(last.x - 80) < 1e-5 && Math.abs(last.y - 14.4) < 1e-5;
      });
      expect(line).toBeDefined();
      expect(line.moves[0].x).toBeCloseTo(48, 5);
      expect(line.moves[0].y).toBeCloseTo(14.4, 5);
    });

    it('keeps the dashed line from the player when attackOrigin is null', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, []);
      input.enemyHoverOverlay = {
        rangeCells: [],
        target: {x: 2, y: 0},
        inRange: false,
        attackOrigin: null,
      };

      renderer.update(input);

      // Линия к цели стартует от персонажа (0,0) → (16, 14.4).
      const lines = renderer.overlayContainer.children.filter(
        (c: any) => c.lines?.length > 0,
      ) as any[];
      const line = lines.find((c) => {
        const last = c.lines[c.lines.length - 1];
        return Math.abs(last.x - 80) < 1e-5 && Math.abs(last.y - 14.4) < 1e-5;
      });
      expect(line).toBeDefined();
      expect(line.moves[0].x).toBeCloseTo(16, 5);
      expect(line.moves[0].y).toBeCloseTo(14.4, 5);
    });

    it('renders nothing when the overlay is null', () => {
      const renderer = new TargetingRenderer();
      const input = makeRenderInput(null, []);

      renderer.update(input);

      expect(renderer.overlayContainer.children.length).toBe(0);
    });
  });
});
