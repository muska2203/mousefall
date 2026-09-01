/**
 * Интеграционные тесты кровавой лужи (blood_puddle) и флакона крови (blood_flask).
 *
 * В отличие от flour-cloud.test.ts, здесь работает реальный контент
 * (`loadTestContent()` → buildContent()): шаблоны, тексты и правила
 * `blood_puddle_applies_bleeding(_on_spawn)` из src/.
 * Сценарий (кровавая ветка, §4.3 docs/game-design/bleed-builds-concept.md):
 * бросок blood_flask создаёт лужу радиуса 1 на дистанции до 2; существо,
 * оказавшееся в зоне появления, получает кровотечение на 2 хода.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {GameSimulation} from '../../../src/simulation/simulation';
import {resetRegistry} from '../../../src/content/registry';
import {loadTestContent} from '../combat-scenarios/helpers';
import {makeEnemy, makeGameState, makePlayer, makeTestMap} from '../../fixtures/gameState';
import type {GameState} from '../../../src/simulation/types';
import type {Entity} from '../../../src/simulation/types';

function createTestPlayer() {
  return makePlayer({
    x: 2,
    y: 5,
    hp: 100,
    maxHp: 100,
    ap: 3,
    maxAp: 3,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    inventory: [
      { instanceId: 'blood_flask_1', templateId: 'blood_flask', quantity: 5, grantedAbilities: [], affixes: [] },
    ],
  });
}

function makeStateWith(entities: Entity[]): GameState {
  const state = makeGameState({ map: makeTestMap() }) as GameState;
  for (const entity of entities) {
    state.entities.set(entity.id, entity);
    if (entity.type === 'player') state.player = entity;
  }
  return state;
}

describe('Флакон крови (blood_flask) и кровавая лужа (blood_puddle)', () => {
  beforeEach(() => {
    loadTestContent();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('бросок blood_flask создаёт лужу радиуса 1; существо в зоне получает кровотечение на 2 хода', () => {
    const player = createTestPlayer();
    const enemy = makeEnemy({ id: 'enemy_in_puddle', x: 4, y: 5 });
    const bystander = makeEnemy({ id: 'enemy_outside', x: 6, y: 5 });
    const state = makeStateWith([player, enemy, bystander]);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.setContentRulesEnabled(true);

    // Бросок на дистанцию 2 (максимальная для blood_flask).
    const result = simulation.dispatch({
      type: 'USE_ITEM',
      entityId: player.id,
      itemInstanceId: 'blood_flask_1',
      targetPosition: { x: 4, y: 5 },
    });
    expect(result.success).toBe(true);
    expect(player.inventory.find(i => i.instanceId === 'blood_flask_1')!.quantity).toBe(4);

    // Лужа создана на всех 9 клетках радиуса 1 вокруг (4,5), слой cover.
    for (let y = 4; y <= 6; y++) {
      for (let x = 3; x <= 5; x++) {
        expect(
          state.tileEffects[y]![x]!.cover?.type,
          `кровавая лужа на (${x}, ${y})`,
        ).toBe('blood_puddle');
      }
    }

    // Враг в зоне появления лужи получил bleeding на 2 хода,
    // зрителю за пределами зоны — нет.
    expect(enemy.statusEffects.some((s) => s.type === 'bleeding' && s.duration === 2)).toBe(true);
    expect(bystander.statusEffects.some((s) => s.type === 'bleeding')).toBe(false);
  });

  it('бросок дальше дальности 2 отклоняется', () => {
    const player = createTestPlayer();
    const state = makeStateWith([player]);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.setContentRulesEnabled(true);

    const result = simulation.dispatch({
      type: 'USE_ITEM',
      entityId: player.id,
      itemInstanceId: 'blood_flask_1',
      targetPosition: { x: 5, y: 5 },
    });
    expect(result.success).toBe(false);
    expect(player.inventory.find(i => i.instanceId === 'blood_flask_1')!.quantity).toBe(5);
    expect(state.tileEffects[5]![5]!.cover).toBeUndefined();
  });

  it('заход существа на лужу обновляет кровотечение до 2 ходов', () => {
    const player = createTestPlayer();
    const enemy = makeEnemy({ id: 'enemy_walker', x: 4, y: 5 });
    const state = makeStateWith([player, enemy]);

    const simulation = GameSimulation.loadSavedGame(state);
    simulation.setDebugEnabled(true);
    simulation.setContentRulesEnabled(true);

    // Лужа на соседней клетке врага (5,5) — без существа в зоне появления.
    const spawn = simulation.dispatch({
      type: 'DEBUG_SPAWN_TILE_EFFECT',
      entityId: player.id,
      effectType: 'blood_puddle',
      position: { x: 5, y: 5 },
    });
    expect(spawn.success).toBe(true);
    expect(enemy.statusEffects.some((s) => s.type === 'bleeding')).toBe(false);

    // Заход врага на лужу реальным ходом (ENTITY_MOVED) вешает bleeding на 2 хода.
    simulation.initializeTestTurnState('enemies', enemy.id);
    const move = simulation.dispatch({
      type: 'MOVE',
      entityId: enemy.id,
      dx: 1,
      dy: 0,
    });
    expect(move.success).toBe(true);
    expect(enemy.x).toBe(5);
    expect(enemy.statusEffects.some((s) => s.type === 'bleeding' && s.duration === 2)).toBe(true);
  });
});
