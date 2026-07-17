/**
 * Интеграционный сценарий: блокировка наложения статуса.
 *
 * Проверяет, что при попытке наложить статус, заблокированный существующим
 * статусом цели, Simulation порождает STATUS_BLOCKED, Presentation создаёт
 * для него патч и анимацию UI_FLOATING_TEXT, а logBuilder добавляет строку
 * в combat log. После применения всех патчей DisplayState совпадает с GameState.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameSimulation } from '../../../src/simulation/simulation';
import {
  makeGameState,
  makePlayer,
  makeEnemy,
  makeTestMap,
} from '../../fixtures/gameState';
import type {
  PlayerEntity,
  EnemyEntity,
  GameState,
} from '../../../src/simulation/types';
import { loadTestContent, setupCombatScenario } from './helpers';
import { rngChance } from '../../../src/utils/rng';
import { buildPresentationPlan } from '../../../src/presentation/displayState/planner';
import { buildAnimationTree } from '../../../src/presentation/animation';
import { extractEvents, gameEventToLog } from '../../../src/presentation/logBuilder';
import { resyncDisplayState } from '../../../src/presentation/displayState/sync';
import type { AnimationNode, AnimationPhase } from '../../../src/presentation/types';
import '@i18n/config';

vi.mock('@utils/rng', () => ({
  createRNG: vi.fn((seed: number) => ({ seed, state: seed >>> 0 })),
  rngChance: vi.fn(),
}));

function createWitcherPlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  return makePlayer({
    x: 5,
    y: 5,
    hp: 100,
    maxHp: 100,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 4, dex: 2, int: 0, vit: 4 },
    abilities: [{ templateId: 'dash', source: 'innate', level: 1, currentCooldown: 0 }],
    ...overrides,
  });
}

function createRat(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return makeEnemy({
    id: `rat_${overrides.x ?? 0}_${overrides.y ?? 0}`,
    templateId: 'cat_small',
    hp: 25,
    maxHp: 25,
    ap: 2,
    maxAp: 2,
    baseStats: { str: 1, dex: 3, int: 0, vit: 0 },
    aiSightRadius: 4,
    ...overrides,
  });
}

function withWallAt(state: GameState, x: number, y: number): GameState {
  state.map.tiles[y]![x] = 'wall';
  return state;
}

/** Рекурсивно собирает все анимационные узлы из фаз. */
function flattenAnimationNodes(phases: AnimationPhase[]): AnimationNode[] {
  const result: AnimationNode[] = [];
  function visit(nodes: AnimationNode[]) {
    for (const node of nodes) {
      result.push(node);
      visit(node.children);
    }
  }
  for (const phase of phases) {
    visit(phase.nodes);
  }
  return result;
}

describe('Status blocked scenario', () => {
  beforeEach(async () => {
    setupCombatScenario();
    vi.mocked(rngChance).mockReturnValue(true);
    await loadTestContent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('dash into wall blocks daze when enemy is stunned', () => {
    const state = withWallAt(makeGameState({ map: makeTestMap() }), 8, 5);
    const player = createWitcherPlayer();
    state.player = player;
    state.entities.set(player.id, player);

    // Делаем клетки врага и стены видимыми, чтобы FOV-фильтр не скрыл анимации.
    state.visible[5]![6] = true;
    state.visible[5]![7] = true;
    state.visible[5]![8] = true;
    state.explored[5]![6] = true;
    state.explored[5]![7] = true;
    state.explored[5]![8] = true;

    // Враг уже оглушён, поэтому попытка наложить dazed будет заблокирована.
    const rat = createRat({
      x: 7,
      y: 5,
      statusEffects: [
        { type: 'stunned', duration: 3, value: 0, statModifiers: null, instanceId: 'stun_test' },
      ],
    });
    state.entities.set(rat.id, rat);

    const sim = GameSimulation.loadSavedGame(state);
    sim.initializeTestTurnState('player', player.id);

    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'dash',
      targets: [{ x: 7, y: 5 }],
    });

    expect(result.success).toBe(true);

    // 1. Simulation порождает событие STATUS_BLOCKED.
    const events = extractEvents(result);
    const blockedEvent = events.find((e) => e.type === 'STATUS_BLOCKED');
    expect(blockedEvent).toBeDefined();
    expect(blockedEvent).toMatchObject({
      entityId: rat.id,
      statusType: 'dazed',
      blockedBy: 'stunned',
    });

    // 2. Presentation создаёт для него DisplayPatch (NO_OP) и PresentationNode.
    const finalState = sim.getState();
    const plan = buildPresentationPlan(result, finalState);
    const blockedNode = plan.find((n) => n.event.type === 'STATUS_BLOCKED');
    expect(blockedNode).toBeDefined();
    expect(blockedNode!.patch.type).toBe('NO_OP');

    // 3. Анимация — UI_FLOATING_TEXT.
    const phases = buildAnimationTree(result, finalState);
    const allNodes = flattenAnimationNodes(phases);
    const floatingText = allNodes.find((n) => n.step.type === 'UI_FLOATING_TEXT');
    expect(floatingText).toBeDefined();

    // 4. logBuilder добавляет строку в combat log.
    const logEntry = gameEventToLog(finalState, blockedEvent!, 'ru');
    expect(logEntry).not.toBeNull();
    expect(logEntry!.text).toContain('dazed');
    expect(logEntry!.text).toContain('заблокировано');

    // 5. После завершения всех анимаций DisplayState совпадает с GameState.
    const syncedDisplay = resyncDisplayState(finalState);
    const gameRat = finalState.entities.get(rat.id) as EnemyEntity;
    const displayRat = syncedDisplay.entities.get(rat.id);

    expect(syncedDisplay.player.x).toBe(finalState.player.x);
    expect(syncedDisplay.player.y).toBe(finalState.player.y);
    expect(displayRat?.x).toBe(gameRat.x);
    expect(displayRat?.y).toBe(gameRat.y);
    expect(displayRat?.hp).toBe(gameRat.hp);
    expect(displayRat?.statusEffects?.map((s) => s.type)).toEqual(
      gameRat.statusEffects.map((s) => s.type),
    );
  });
});
