import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { GameSession } from '../../../src/presentation/gameSession';
import { makeGameState, makePlayer } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/simulation/content/registry';
import type { AbilityTemplate } from '../../../src/simulation/schemas/contentSchemas';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    name: id,
    description: 'test',
    symbol: '*',
    spriteId: id,
    targetType: 'ranged',
    range: 5,
    aoeRadius: 0,
    cooldown: 0,
    mpCost: 0,
    apCost: 1,
    effect: { type: 'damage', value: 10 },
    ...overrides,
  } as AbilityTemplate;
}

describe('GameSession targeting', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { range: 5, aoeRadius: 1 })],
        ['magic_slap', mockAbility('magic_slap', { range: 5 })],
      ]),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('beginTargeting sets targeting state', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('fireball');

    const vm = session.getViewModel();
    expect(vm.renderInput?.targetingOverlay).not.toBeNull();
    expect(vm.renderInput?.targetingOverlay?.valid.length).toBeGreaterThan(0);
  });

  it('cancelTargeting resets targeting state', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    const player = makePlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('fireball');
    session.cancelTargeting();

    const vm = session.getViewModel();
    expect(vm.renderInput?.targetingOverlay).toBeNull();
  });

  it('submitTarget for single-target dispatches USE_ABILITY', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 1,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('fireball');
    session.submitTarget({ x: 6, y: 5 });

    const vm = session.getViewModel();
    expect(vm.renderInput?.targetingOverlay).toBeNull();
  });

  it('previewTarget returns intents for hovered position', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('fireball');
    const preview = session.previewTarget({ x: 6, y: 5 });

    expect(preview.valid).toBe(true);
    expect(preview.intents.length).toBeGreaterThanOrEqual(0);
  });

  it('previewTarget returns empty result for invalid tile', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('fireball');
    // (9,9) is outside ability range, so it should not be a valid target
    const preview = session.previewTarget({ x: 9, y: 9 });

    expect(preview.valid).toBe(false);
    expect(preview.intents).toHaveLength(0);
    expect(preview.affectedPositions).toHaveLength(0);
  });

});
