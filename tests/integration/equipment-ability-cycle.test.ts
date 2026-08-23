import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GameSimulation } from '../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../src/content/registry';
import type { ItemTemplate, AbilityTemplate, PlayerTemplate, DoorTemplate } from '../../src/content/schemas';
import { defaultTestMapParams } from '../fixtures/gameState';

function mockAbility(id: string): AbilityTemplate {
  return {
    id,
    kind: 'fireball',
    range: 5,
    aoeRadius: 1,
    centerDamage: 20,
    aoeDamage: 10,
    cooldown: 3,
    apCost: 1,
    aiPreparable: false,
    requiredWeaponTags: [],
    tags: [],
    ruleIds: [],
  };
}

function mockItem(id: string): ItemTemplate {
  return {
    id,
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [{ abilityId: 'fireball', weight: 1 }],
    fixedModifiers: [],
    grantedAbilities: [],
    apCost: 1,
    weapon: { damage: { min: 5, max: 5 }, range: 2, minRange: 1, damageDistribution: [{ damageTag: 'damage.physical.blunt', weight: 1.0 }], tags: [] },
  };
}

function mockUnarmed(): ItemTemplate {
  return {
    id: 'unarmed',
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    fixedModifiers: [],
    grantedAbilities: [],
    apCost: 1,
    weapon: { damage: { min: 1, max: 1 }, range: 1, minRange: 1, damageDistribution: [{ damageTag: 'damage.physical.blunt', weight: 1.0 }], tags: [] },
  };
}

function mockPlayerTemplate(id: string): PlayerTemplate {
  return {
    id,
    portraitImg: '',
    maxAp: 2,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    isDefault: false,
    innateAbilities: [],
  };
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map([
      ['test_hero', mockPlayerTemplate('test_hero')],
    ]),
    items: new Map([
      ['test_staff', mockItem('test_staff')],
      ['unarmed', mockUnarmed()],
    ]),
    abilities: new Map([
      ['fireball', mockAbility('fireball')],
    ]),
    maps: new Map(),
    doors: new Map([
      ['wooden_door', {
        id: 'wooden_door',
        maxHp: 30,
        armor: 2,
      } as DoorTemplate],
    ]),
    stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
});

afterEach(() => {
  resetRegistry();
});

describe('Полный цикл экипировки и скилла', () => {
  it('экипировка даёт скилл, снятие забирает, повторная экипировка возвращает', () => {
    const config = {
      templateId: 'test_hero',
      attributes: { strength: 1, agility: 1, vitality: 1, intelligence: 1, luck: 1 },
      startingEquipment: ['test_staff'],
    };

    const simulation = GameSimulation.createNewGame(42, config, defaultTestMapParams);
    const state = simulation.getState();

    // 1. Проверить: player.inventory[0].grantedAbilities не пуст
    expect(state.player.inventory.length).toBeGreaterThan(0);
    expect(state.player.inventory[0]!.grantedAbilities.length).toBeGreaterThan(0);
    expect(state.player.inventory[0]!.grantedAbilities[0]!.templateId).toBe('fireball');

    // 2. Проверить: player.abilities содержит скилл с source === 'equipment'
    expect(state.player.abilities.some(a => a.source === 'equipment')).toBe(true);
    const equippedAbility = state.player.abilities.find(a => a.source === 'equipment');
    expect(equippedAbility).toBeDefined();
    expect(equippedAbility!.templateId).toBe('fireball');

    // 3. Выполнить UNEQUIP weapon
    const unequipAction = { type: 'UNEQUIP' as const, entityId: 'player', slot: 'weapon' as const };
    const unequipResult = simulation.dispatch(unequipAction);
    expect(unequipResult.success).toBe(true);

    // 4. Проверить: player.abilities не содержит скилл
    expect(state.player.abilities.some(a => a.source === 'equipment')).toBe(false);

    // 5. Проверить: слот оружия не пуст — автоматически экипирован unarmed
    expect(state.player.equippedWeaponId).toBe('unarmed');
    expect(state.player.equippedWeaponInstanceId).not.toBeNull();
    expect(state.player.inventory.some(i => i.templateId === 'unarmed')).toBe(true);

    // 6. Выполнить EQUIP того же посоха
    const staffInstanceId = state.player.inventory[0]!.instanceId;
    const equipAction = { type: 'EQUIP' as const, entityId: 'player', itemInstanceId: staffInstanceId };
    const equipResult = simulation.dispatch(equipAction);
    expect(equipResult.success).toBe(true);

    // 7. Проверить: player.abilities снова содержит скилл
    expect(state.player.abilities.some(a => a.source === 'equipment')).toBe(true);
    const reEquippedAbility = state.player.abilities.find(a => a.source === 'equipment');
    expect(reEquippedAbility).toBeDefined();
    expect(reEquippedAbility!.templateId).toBe('fireball');

    // 8. Проверить: экземпляр unarmed удалён из инвентаря при замене
    expect(state.player.inventory.some(i => i.templateId === 'unarmed')).toBe(false);
  });
});
