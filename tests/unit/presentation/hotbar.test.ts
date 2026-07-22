/**
 * Unit tests for hotbar (quick access panel) behavior in GameSession.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import '@i18n/config';
import { GameSession } from '../../../src/presentation/gameSession';
import { makeGameState, makePlayer } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import { initSkillRegistry } from '../../../src/simulation/skills/index';
import type { AbilityTemplate, ItemTemplate } from '../../../src/content/schemas';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 0,
    apCost: 1,
    ...overrides,
  } as AbilityTemplate;
}

function mockItem(id: string, overrides: Partial<ItemTemplate> & Record<string, unknown> = {}): ItemTemplate {
  return {
    id,
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    value: 0,
    apCost: 1,
    consumable: { effect: 'heal', value: 10 },
    ...overrides,
  } as ItemTemplate;
}

describe('GameSession hotbar', () => {
  beforeEach(() => {
    resetRegistry();
    initSkillRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([
        ['health_potion', mockItem('health_potion', { name: 'Зелье здоровья' })],
        ['mana_potion', mockItem('mana_potion', { name: 'Зелье маны', consumable: { effect: 'buff', value: 5, duration: 3 } })],
      ]),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { cooldown: 2, apCost: 2 })],
        ['magic_slap', mockAbility('magic_slap')],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
});
  });

  afterEach(() => {
    resetRegistry();
  });

  it('renders 10 hotbar slots', () => {
    const player = makePlayer();
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const hotbar = session.getViewModel().renderInput!.hotbar;
    expect(hotbar).toHaveLength(10);
    expect(hotbar.every(slot => slot.kind === 'empty')).toBe(true);
  });

  it('auto-fills new consumable into first empty slot', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'potion_1', templateId: 'health_potion', quantity: 2, grantedAbilities: [] },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const hotbar = session.getViewModel().renderInput!.hotbar;
    expect(hotbar[0]!.kind).toBe('consumable');
    expect(hotbar[0]!.templateId).toBe('health_potion');
    expect(hotbar[0]!.quantity).toBe(2);
    expect(hotbar[1]!.kind).toBe('empty');
  });

  it('groups multiple stacks of the same consumable into a single hotbar slot', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'potion_1', templateId: 'health_potion', quantity: 2, grantedAbilities: [] },
        { instanceId: 'potion_2', templateId: 'health_potion', quantity: 3, grantedAbilities: [] },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const hotbar = session.getViewModel().renderInput!.hotbar;
    const healthPotionSlots = hotbar.filter(s => s.kind === 'consumable' && s.templateId === 'health_potion');
    expect(healthPotionSlots).toHaveLength(1);
    expect(healthPotionSlots[0]!.quantity).toBe(5);
  });

  it('auto-fills new skill into first empty slot before consumables', () => {
    const player = makePlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
      inventory: [
        { instanceId: 'potion_1', templateId: 'health_potion', quantity: 1, grantedAbilities: [] },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const hotbar = session.getViewModel().renderInput!.hotbar;
    expect(hotbar[0]!.kind).toBe('skill');
    expect(hotbar[0]!.abilityId).toBe('fireball');
    expect(hotbar[1]!.kind).toBe('consumable');
    expect(hotbar[1]!.templateId).toBe('health_potion');
  });

  it('does not duplicate already bound consumables or skills on repeated view model builds', () => {
    const player = makePlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
      inventory: [
        { instanceId: 'potion_1', templateId: 'health_potion', quantity: 3, grantedAbilities: [] },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    // Первый ViewModel заполняет слоты.
    session.getViewModel();

    // Повторный запрос без изменений состояния — привязки не дублируются.
    const hotbar = session.getViewModel().renderInput!.hotbar;

    const skillSlots = hotbar.filter(s => s.kind === 'skill' && s.abilityId === 'fireball');
    const itemSlots = hotbar.filter(s => s.kind === 'consumable' && s.templateId === 'health_potion');
    expect(skillSlots).toHaveLength(1);
    expect(itemSlots).toHaveLength(1);
    expect(itemSlots[0]!.quantity).toBe(3);
  });

  it('shows depleted consumable with quantity 0 and allows refill', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'potion_1', templateId: 'health_potion', quantity: 1, grantedAbilities: [] },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    // Используем зелье — оно удалится из инвентаря.
    session.activateHotbarSlot(0);
    session.onAnimationsComplete();

    const hotbarAfterUse = session.getViewModel().renderInput!.hotbar;
    const slot = hotbarAfterUse[0]!;
    expect(slot.kind).toBe('consumable');
    expect(slot.depleted).toBe(true);
    expect(slot.quantity).toBe(0);
    expect(slot.isAvailable).toBe(false);
    expect(slot.icon).not.toBeNull();

    // Добавляем новый стак зелий — depleted-слот должен перезаполниться.
    player.inventory.push({ instanceId: 'potion_2', templateId: 'health_potion', quantity: 2, grantedAbilities: [] });
    // Прямая мутация состояния вне session не инвалидирует кеш ViewModel.
    (session as any).notify();
    const hotbarAfterRefill = session.getViewModel().renderInput!.hotbar;
    const refilledSlot = hotbarAfterRefill[0]!;
    expect(refilledSlot.kind).toBe('consumable');
    expect(refilledSlot.templateId).toBe('health_potion');
    expect(refilledSlot.quantity).toBe(2);
    expect(refilledSlot.depleted).toBeFalsy();
  });

  it('clears skill slot when skill is revoked', () => {
    const player = makePlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    expect(session.getViewModel().renderInput!.hotbar[0]!.abilityId).toBe('fireball');

    const playerWithoutSkill = makePlayer({ abilities: [] });
    const newState = makeGameState({ player: playerWithoutSkill, entities: new Map([[playerWithoutSkill.id, playerWithoutSkill]]) });
    session.loadGame(newState);

    const hotbar = session.getViewModel().renderInput!.hotbar;
    expect(hotbar[0]!.kind).toBe('empty');
  });

  it('activateHotbarSlot begins targeting for skill', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 3,
      maxAp: 3,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;

    const session = new GameSession();
    session.loadGame(state);

    session.activateHotbarSlot(0);

    expect(session.isTargeting()).toBe(true);
    const hotbar = session.getViewModel().renderInput!.hotbar;
    expect(hotbar[0]!.isActive).toBe(true);
  });

  it('activateHotbarSlot dispatches USE_ITEM for consumable', () => {
    const player = makePlayer({
      hp: 50,
      maxHp: 100,
      inventory: [
        { instanceId: 'potion_1', templateId: 'health_potion', quantity: 1, grantedAbilities: [] },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    session.activateHotbarSlot(0);
    session.onAnimationsComplete();

    expect(session.getViewModel().renderInput!.inventory.length).toBe(0);
  });

  it('shows cooldown and maxCooldown for skill on cooldown', () => {
    const player = makePlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 2 }],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const slot = session.getViewModel().renderInput!.hotbar[0]!;
    expect(slot.kind).toBe('skill');
    expect(slot.cooldown).toBe(2);
    expect(slot.maxCooldown).toBe(2);
    expect(slot.isAvailable).toBe(false);
  });

  it('shows AP cost for skills and consumables', () => {
    const player = makePlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
      inventory: [
        { instanceId: 'potion_1', templateId: 'health_potion', quantity: 1, grantedAbilities: [] },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const hotbar = session.getViewModel().renderInput!.hotbar;
    expect(hotbar[0]!.apCost).toBe(2);
    expect(hotbar[1]!.apCost).toBe(1);
  });

  it('includes skill tooltip with ability details', () => {
    const player = makePlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const slot = session.getViewModel().renderInput!.hotbar[0]!;
    expect(slot.kind).toBe('skill');
    const tooltip = slot.tooltip;
    expect(tooltip?.kind).toBe('skill');
    if (tooltip?.kind !== 'skill') return;
    expect(tooltip.name).toBe('Огненный шар');
    expect(tooltip.maxCooldown).toBe(2);
    expect(tooltip.apCost).toBe(2);
    expect(tooltip.tags).toEqual([]);
  });

  it('includes consumable tooltip with item details', () => {
    const player = makePlayer({
      inventory: [
        { instanceId: 'potion_1', templateId: 'health_potion', quantity: 3, grantedAbilities: [] },
      ],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const session = new GameSession();
    session.loadGame(state);

    const slot = session.getViewModel().renderInput!.hotbar[0]!;
    expect(slot.kind).toBe('consumable');
    const tooltip = slot.tooltip;
    expect(tooltip?.kind).toBe('consumable');
    if (tooltip?.kind !== 'consumable') return;
    expect(tooltip.item.name).toBe('Зелье здоровья');
    expect(tooltip.item.stackCount).toBe(3);
    expect(tooltip.item.tags).toEqual([]);
  });
});
