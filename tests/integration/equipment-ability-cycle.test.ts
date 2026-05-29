import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GameSimulation } from '../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../src/content/registry';
import type { ItemTemplate, AbilityTemplate, PlayerTemplate } from '../../src/content/schemas';
import { initSkillRegistry } from '../../src/simulation/skills/index';
import { defaultTestMapParams } from '../fixtures/gameState';

function mockAbility(id: string): AbilityTemplate {
  return {
    id,
    name: 'Огненный шар',
    description: 'Тестовая способность',
    cooldown: 3,
    castTime: 0,
  };
}

function mockItem(id: string): ItemTemplate {
  return {
    id,
    name: 'Тестовый посох',
    description: 'Тест',
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [{ abilityId: 'fireball', weight: 1 }],
    equipModifiers: [],
    grantedAbilities: [],
    weapon: { baseDamage: 5, damageFormulaId: 'staff', range: 2 },
  };
}

function mockPlayerTemplate(id: string): PlayerTemplate {
  return {
    id,
    name: 'Тестовый герой',
    description: '',
    portraitImg: '',
    renderScale: 1,
  };
}

beforeEach(() => {
  initSkillRegistry();
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map([
      ['test_hero', mockPlayerTemplate('test_hero')],
    ]),
    items: new Map([
      ['test_staff', mockItem('test_staff')],
    ]),
    abilities: new Map([
      ['fireball', mockAbility('fireball')],
    ]),
    maps: new Map(),
    stairs: new Map(),
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

    // 5. Проверить: equippedWeaponInstanceId === null
    expect(state.player.equippedWeaponInstanceId).toBeNull();

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
  });
});
