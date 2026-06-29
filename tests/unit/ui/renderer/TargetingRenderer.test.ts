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
        activeCast: null,
      },
      visible: [],
      explored: [],
      turn: {activeSide: 'PLAYER' as const, round: 1},
      phase: 'playing' as const,
      floor: 1,
      floorSnapshots: [],
      rng: {seed: 1, state: 1},
      nextEntityCounter: 0,
      runStats: {startTime: Date.now(), enemiesKilled: 0, chestsOpened: 0, itemsPickedUp: 0},
    },
    highlightedPath: null,
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
    primaryStatusByEntity: new Map(),
    runStats: {startTime: Date.now(), enemiesKilled: 0, chestsOpened: 0, itemsPickedUp: 0},
    fieldObjectPopover: null,
    interactionHint: null,
    aiPreparedIntents,
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
});
