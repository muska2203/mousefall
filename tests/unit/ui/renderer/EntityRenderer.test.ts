/**
 * Unit tests for EntityRenderer.
 */

import {describe, expect, it, vi} from 'vitest';

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

function makeRenderInput(playerOverrides?: Partial<RenderInput['state']['player']>): RenderInput {
  const player = {
    id: 'player' as const,
    type: 'player' as const,
    displayName: 'Герой',
    x: 0,
    y: 0,
    blocksMovement: true as const,
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
    mp: 0,
    maxMp: 0,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    statModifiers: [],
    dodgeChance: 0,
    accuracy: 0,
    critChance: 0,
    critMultiplier: 1.5,
    statusEffects: [],
    abilities: [],
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
      visible: [],
      explored: [],
      turn: {activeSide: 'PLAYER' as const, round: 1},
      phase: 'playing' as const,
      floor: 1,
      floorSnapshots: [],
      rng: {seed: 1, state: 1},
      nextEntityCounter: 0,
    },
    portraitId: null,
    highlightedPath: null,
    animations: null,
    phase: 'idle' as const,
    zoom: 1,
    playerStats: {
      level: player.level,
      xp: player.xp,
      hp: player.hp,
      maxHp: player.maxHp,
      mp: player.mp,
      maxMp: player.maxMp,
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
      weaponDamage: null,
    },
    targetingOverlay: null,
    animationBatchId: 0,
    playerSkills: [],
    heroStats: [],
    equipSlots: [],
  };
}

describe('EntityRenderer', () => {
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
});
