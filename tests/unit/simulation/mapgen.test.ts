import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEnemy } from '@simulation/systems/mapgen';
import { initRegistry, resetRegistry } from '@content/registry';
import type { EntityTemplate } from '@content/schemas';
import { makeGameState } from '../../fixtures/gameState';

function makeEntityTemplate(partial: Partial<EntityTemplate> = {}): EntityTemplate {
  return {
    id: 'test_enemy',
    health: { max: 30 },
    combat: { damage: 5, armor: 0 },
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    equipment: {},
    abilities: [],
    lootTable: [],
    lootDropTable: [{ count: 1, weight: 1 }],
    xpReward: 0,
    renderScale: 1,
    aiSightRadius: 6,
    aiStrategyId: 'hunter',
    ...partial,
  } as EntityTemplate;
}

describe('createEnemy', () => {
  beforeEach(() => {
    resetRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('устанавливает текущие HP равными пересчитанным maxHp при спавне', () => {
    initRegistry({
      entities: new Map([
        ['test_cat', makeEntityTemplate({
          id: 'test_cat',
          health: { max: 30 },
          baseStats: { str: 0, dex: 0, int: 0, vit: 2 }, // vit=2 даёт +20 к maxHp
        })],
      ]),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
});

    const state = makeGameState();
    const enemy = createEnemy(state, 'test_cat', 5, 5);

    // baseMaxHp = 30, vit = 2 → maxHp = 30 + 2*10 = 50
    expect(enemy.maxHp).toBe(50);
    expect(enemy.hp).toBe(50);
  });

  it('сохраняет hp равным maxHp даже при vit=0', () => {
    initRegistry({
      entities: new Map([
        ['test_cat', makeEntityTemplate({
          id: 'test_cat',
          health: { max: 25 },
          baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
        })],
      ]),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
});

    const state = makeGameState();
    const enemy = createEnemy(state, 'test_cat', 5, 5);

    expect(enemy.maxHp).toBe(25);
    expect(enemy.hp).toBe(25);
  });
});
