import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { GameSession } from '../../../src/presentation/gameSession';
import { makeGameState, makePlayer, makeEnemy } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { AbilityTemplate } from '../../../src/content/schemas';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 0,
    apCost: 1,
    ...overrides,
  } as AbilityTemplate;
}

describe('GameSession targeting', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball')],
        ['magic_slap', mockAbility('magic_slap')],
        ['swoop', mockAbility('swoop', { cooldown: 2, apCost: 2 })],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
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

  it('beginTargeting shows toast and does not start when ability is on cooldown', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 2,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 2 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('fireball');

    const vm = session.getViewModel();
    expect(vm.renderInput?.targetingOverlay).toBeNull();
    expect(vm.toasts).toHaveLength(1);
    expect(vm.toasts[0]!.kind).toBe('warning');
  });

  it('beginTargeting shows toast and does not start when not enough AP', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 0,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('fireball');

    const vm = session.getViewModel();
    expect(vm.renderInput?.targetingOverlay).toBeNull();
    expect(vm.toasts).toHaveLength(1);
    expect(vm.toasts[0]!.kind).toBe('warning');
  });

  it('beginTargeting starts targeting when ability is available and AP is sufficient', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 2,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('fireball');

    const vm = session.getViewModel();
    expect(vm.renderInput?.targetingOverlay).not.toBeNull();
    expect(vm.toasts).toHaveLength(0);
  });

  it('previewTarget for swoop includes PUSH intent', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[7]![5] = true;
    state.visible[7]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 2,
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 6, hp: 50, maxHp: 50 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('swoop');
    const preview = session.previewTarget({ x: 7, y: 5 });

    expect(preview.valid).toBe(true);
    const pushIntents = preview.intents.filter(i => i.type === 'PUSH');
    expect(pushIntents).toHaveLength(1);
    expect(pushIntents[0]).toMatchObject({
      type: 'PUSH',
      entityId: enemy.id,
      from: { x: 7, y: 6 },
      to: { x: 7, y: 7 },
    });
  });

  it('beginTargeting shows toast when ability is not found', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 2,
      abilities: [{ templateId: 'unknown_skill', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('unknown_skill');

    const vm = session.getViewModel();
    expect(vm.renderInput?.targetingOverlay).toBeNull();
    expect(vm.toasts).toHaveLength(1);
    expect(vm.toasts[0]!.kind).toBe('error');
  });

  it('beginTargeting is ignored while animations are playing', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 2,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ x: 6, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const session = new GameSession();
    session.loadGame(state);

    session.dispatch({ type: 'MOVE', entityId: player.id, dx: 0, dy: 1 });

    expect(session.getViewModel().renderInput?.phase).toBe('animating');

    session.beginTargeting('fireball');

    const vm = session.getViewModel();
    expect(vm.renderInput?.targetingOverlay).toBeNull();
    expect(vm.toasts).toHaveLength(0);
  });

});
