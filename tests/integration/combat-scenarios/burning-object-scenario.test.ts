/**
 * Интеграционный сценарий: поджог деревянной двери огненным мечом.
 *
 * Проверяет:
 * - огненный урон поджигает горючий объект через `fire_damage_ignites_flammable_object`;
 * - `burning_tick_damage` наносит урон двери на ходу окружения;
 * - дверь отображается с эффектом `burning` в DisplayState.
 */

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import type {DoorEntity, Entity, EntityId} from '../../../src/simulation/types';
import {createStartingEquipment} from '../../../src/simulation/systems/starting-equipment';
import {makeGameState, makePlayer, makeDoor, makeTestMap} from '../../fixtures/gameState';
import {createTestSimulation, advanceToPlayerTurn} from '../../helpers/simulation';
import {loadTestContent, registerLegacyTemplates, setupCombatScenario} from './helpers';
import {commonFlamingSword} from '../../../src/content/templates/legacy/items/weapons/common-flaming-sword';
import {modFireDamageMultiplier} from '../../../src/content/templates/legacy/modifiers/mod-fire-damage-multiplier';
import {buildPresentationPlan} from '../../../src/presentation/displayState/planner';
import {resyncDisplayState} from '../../../src/presentation/displayState/sync';
import {extractEvents} from '../../../src/presentation/logBuilder';

vi.mock('@utils/rng', () => ({
  createRNG: vi.fn((seed: number) => ({ seed, state: seed >>> 0 })),
  rngChance: vi.fn(),
  rngFloat: vi.fn(() => 0.5),
  rngInt: vi.fn((_rng: unknown, min: number) => min),
}));

import {rngChance} from '../../../src/utils/rng';

function createWitcherPlayer(overrides: Partial<ReturnType<typeof makePlayer>> = {}) {
  return makePlayer({
    x: 5,
    y: 5,
    hp: 100,
    maxHp: 100,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 4, dex: 2, int: 0, vit: 4 },
    ...overrides,
  });
}

describe('Burning object scenario', () => {
  beforeEach(async () => {
    setupCombatScenario();
    vi.mocked(rngChance).mockReturnValue(true);
    await loadTestContent();
    // Огненный меч и его модификатор архивированы — регистрируем из legacy.
    registerLegacyTemplates({ items: [commonFlamingSword], modifiers: [modFireDamageMultiplier] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('flaming sword ignites a wooden door and burning ticks deal damage', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = createWitcherPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    createStartingEquipment(state, player, ['common_flaming_sword']);

    const door = makeDoor({ id: 'door_1', x: 6, y: 5 });
    state.entities.set(door.id, door);

    // Делаем клетку двери видимой.
    state.visible[5]![6] = true;
    state.explored[5]![6] = true;

    const sim = createTestSimulation(state);

    const doorHpStart = door.hp;

    const result = sim.dispatch({ type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 });
    expect(result.success).toBe(true);

    // Дверь должна получить статус горения.
    expect(door.statusEffects.some((s) => s.type === 'burning')).toBe(true);

    // Завершаем ход и прокручиваем до возвращения игрока — должен отработать ход окружения.
    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(sim);

    // Горение нанесло урон двери.
    expect(door.hp).toBeLessThan(doorHpStart);

    // Событие STATUS_APPLIED есть в плане.
    const events = extractEvents(result);
    const burningApplied = events.some(
      (e) => e.type === 'STATUS_APPLIED' && (e as any).effect.type === 'burning',
    );
    expect(burningApplied).toBe(true);

    // DisplayState содержит горящую дверь.
    const displayState = resyncDisplayState(sim.getState());
    const displayDoor = displayState.entities.get(door.id);
    expect(displayDoor?.statusEffects?.some((s) => s.type === 'burning')).toBe(true);
  });
});
