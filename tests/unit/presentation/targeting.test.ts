import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { GameSession } from '../../../src/presentation/gameSession';
import { makeGameState, makePlayer, makeEnemy, createTestTerrains } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { AbilityTemplate } from '../../../src/content/schemas';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    kind: 'fireball',
    cooldown: 0,
    apCost: 1,
    ...overrides,
  } as AbilityTemplate;
}

describe('GameSession targeting', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { range: 5, aoeRadius: 1, centerDamage: 20, aoeDamage: 10 })],
        ['magic_slap', mockAbility('magic_slap', { kind: 'magicSlap', range: 5, targetCount: 3, baseDamage: 12 })],
        ['swoop', mockAbility('swoop', { kind: 'swoop', jumpRadius: 2, aoeRadius: 1, baseDamage: 8, cooldown: 2, apCost: 2 })],
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
      x: 1,
      y: 1,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('fireball');
    // (9,9) — чебышёвская дистанция 8 от игрока (1,1), вне дальности fireball (5)
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

  it('targeting overlay for magic_slap includes castable pattern cells even without targets', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 2,
      abilities: [{ templateId: 'magic_slap', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const session = new GameSession();
    session.loadGame(state);
    session.beginTargeting('magic_slap');

    const overlay = session.getViewModel().renderInput?.targetingOverlay;
    expect(overlay).not.toBeNull();
    // Валидных целей нет (на поле никого), но паттерн прицеливания заполнен.
    expect(overlay!.valid).toHaveLength(0);
    expect(overlay!.radiusCells!.length).toBeGreaterThan(0);
    expect(overlay!.radiusCells!.some(p => p.x === 6 && p.y === 6)).toBe(true);
    // Клетка кастера в паттерн не входит.
    expect(overlay!.radiusCells!.some(p => p.x === 5 && p.y === 5)).toBe(false);
  });

  it('targeting overlay for fireball has no castable pattern (вид не задаёт паттерн)', () => {
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

    const overlay = session.getViewModel().renderInput?.targetingOverlay;
    expect(overlay).not.toBeNull();
    expect(overlay!.radiusCells).toEqual([]);
  });

});
