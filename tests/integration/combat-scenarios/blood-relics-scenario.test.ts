/**
 * Интеграционный сценарий: пары «плюс/минус» реликвий «Кровавое эхо» и «Жатва»
 * в реальном бою (этап 3 плана docs/plans/bleed-builds-implementation.md).
 *
 * Контент реальный (loadTestContent → buildContent): реликвии выдаются через
 * GRANT_RELIC, удары идут через dispatch(ATTACK) с настоящим сырорезом
 * (weapon_sword_splinter_blade, фирменный mod_blood_on_hit).
 *
 * Проверяет:
 * - Эхо, плюс: ваншот рубящим с on-hit кровотечением лечит владельца на 2 HP
 *   (модель 1 порядка смерти: bleed, наложенный смертельным ударом, виден
 *   реакциям на ENTITY_DIED);
 * - Эхо, минус: естественное спадание bleeding (REMOVE_EXPIRED_STATUS_EFFECTS →
 *   STATUS_REMOVED) наносит владельцу 1 внутренний урон даже вдали от него
 *   (reach: 'global');
 * - Жатва, плюс: добивание кровоточащего руками возвращает 1 AP
 *   (арифметика: restoreAp до списания стоимости атаки);
 * - Жатва, минус: дот-килл кровоточащего (источник смерти — сама жертва)
 *   отнимает 1 AP, а плюс при этом молчит.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {resetRegistry} from '../../../src/content/registry';
import {ExecutionBuilder} from '../../../src/simulation/core-types';
import type {Intent} from '../../../src/simulation/core-types';
import {executeGrantRelicIntent} from '../../../src/simulation/systems/intents/grant-relic-intent-executor';
import {executeIntent} from '../../../src/simulation/systems/intents/execute-intent';
import {createStartingEquipment} from '../../../src/simulation/systems/starting-equipment';
import {makeEnemy, makeGameState, makePlayer, makeTestMap} from '../../fixtures/gameState';
import {createTestSimulation} from '../../helpers/simulation';
import {loadTestContent} from './helpers';
import type {GameState, PlayerEntity} from '../../../src/simulation/types';

function createPlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  return makePlayer({
    x: 5,
    y: 5,
    hp: 50,
    maxHp: 100,
    ap: 2,
    maxAp: 2,
    baseStats: {str: 4, dex: 2, int: 0, vit: 4},
    ...overrides,
  });
}

/** Собирает состояние с игроком в (5,5) и выдаёт ему реликвию через GRANT_RELIC. */
function setupStateWithRelic(templateId: string): {state: GameState; player: PlayerEntity} {
  const state = makeGameState({map: makeTestMap()});
  const player = createPlayer();
  state.player = player;
  state.entities.set(player.id, player);

  const builder = new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    isFieldEvent: false,
    action: {type: 'END_TURN', entityId: player.id},
  });
  const result = executeGrantRelicIntent(state, {type: 'GRANT_RELIC', entityId: player.id, templateId}, builder, builder.root);
  expect(result).not.toBeNull();
  return {state, player};
}

function spawnBleedingEnemy(
  state: GameState,
  overrides: {id: string; x: number; y: number; hp?: number; duration?: number},
) {
  const enemy = makeEnemy({
    id: overrides.id,
    x: overrides.x,
    y: overrides.y,
    hp: overrides.hp ?? 20,
    maxHp: 20,
    ap: 0,
  });
  enemy.statusEffects.push({type: 'bleeding', duration: overrides.duration ?? 2, value: 0, statModifiers: null});
  state.entities.set(enemy.id, enemy);
  return enemy;
}

/** Прямое исполнение интента внутри состояния (реакции разрешаются движком). */
function runIntent(state: GameState, intent: Intent): void {
  const builder = new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    isFieldEvent: false,
    action: {type: 'END_TURN', entityId: 'any'},
  });
  executeIntent(state, intent, builder, builder.root);
}

describe('Кровавое эхо — пара плюс/минус в бою', () => {
  beforeEach(() => {
    loadTestContent();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('плюс: ваншот сырорезом кровоточащего врага лечит владельца на 2 HP (модель 1)', () => {
    const {state, player} = setupStateWithRelic('relic_blood_echo');
    createStartingEquipment(state, player, ['weapon_sword_splinter_blade']);

    // Свежий враг БЕЗ кровотечения: bleed наложится смертельным ударом
    // (on-hit), и реакция на ENTITY_DIED обязана его увидеть.
    const enemy = makeEnemy({id: 'enemy_1', x: 6, y: 5, hp: 4, maxHp: 20, ap: 0});
    state.entities.set(enemy.id, enemy);

    const sim = createTestSimulation(state);
    const hpBefore = player.hp;
    const result = sim.dispatch({type: 'ATTACK', entityId: player.id, dx: 1, dy: 0});

    expect(result.success).toBe(true);
    expect(enemy.isAlive).toBe(false);
    // Модель 1: труп сохраняет наложенное смертельным ударом кровотечение.
    expect(enemy.statusEffects.some((s) => s.type === 'bleeding')).toBe(true);
    // Плюс Эха сработал на «кровоточащую» цель: +2 HP.
    expect(player.hp).toBe(hpBefore + 2);
  });

  it('минус: спадание кровотечения у далёкого врага бьёт владельца на 1 внутренний урон', () => {
    const {state, player} = setupStateWithRelic('relic_blood_echo');
    const farEnemy = spawnBleedingEnemy(state, {id: 'enemy_far', x: 1, y: 1, duration: 0});

    const hpBefore = player.hp;
    // duration 0 → REMOVE_EXPIRED_STATUS_EFFECTS снимает bleeding и эмитит STATUS_REMOVED.
    runIntent(state, {type: 'REMOVE_EXPIRED_STATUS_EFFECTS', entityId: farEnemy.id});

    expect(farEnemy.statusEffects.some((s) => s.type === 'bleeding')).toBe(false);
    expect(player.hp).toBe(hpBefore - 1);
  });

  it('минус: смерть кровоточащего НЕ считается спаданием (STATUS_REMOVED не порождается)', () => {
    const {state, player} = setupStateWithRelic('relic_blood_echo');
    const victim = spawnBleedingEnemy(state, {id: 'enemy_1', x: 6, y: 5, hp: 5});

    const hpBefore = player.hp;
    runIntent(state, {
      type: 'DAMAGE',
      entityId: victim.id,
      sourceEntityId: player.id,
      damage: 10,
      tags: ['damage.physical.slashing', 'delivery.weapon'],
    });

    expect(victim.isAlive).toBe(false);
    // Плюс (добивание кровоточащего) сработал: +2 HP; минус молчал — кровотечение
    // осталось на трупе до cleanup, спадания не было.
    expect(player.hp).toBe(hpBefore + 2);
  });
});

describe('Жатва — пара плюс/минус в бою', () => {
  beforeEach(() => {
    loadTestContent();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('плюс: добивание кровоточащего руками возвращает 1 AP (до списания стоимости атаки)', () => {
    const {state, player} = setupStateWithRelic('relic_blood_reaper');
    createStartingEquipment(state, player, ['weapon_sword_splinter_blade']);
    player.ap = 1; // ровно на одну атаку

    const enemy = spawnBleedingEnemy(state, {id: 'enemy_1', x: 6, y: 5, hp: 4});

    const sim = createTestSimulation(state);
    const result = sim.dispatch({type: 'ATTACK', entityId: player.id, dx: 1, dy: 0});

    expect(result.success).toBe(true);
    expect(enemy.isAlive).toBe(false);
    // Реакции на смерть разрешаются до списания стоимости действия:
    // 1 → min(maxAp=2, 1+1) = 2 → 2 − 1 (атака) = 1. Без правила осталось бы 0.
    expect(player.ap).toBe(1);
  });

  it('минус: дот-килл кровоточащего отнимает 1 AP, а плюс молчит (атрибуция тика жертве)', () => {
    const {state, player} = setupStateWithRelic('relic_blood_reaper');
    player.ap = 1;

    const victim = spawnBleedingEnemy(state, {id: 'enemy_1', x: 8, y: 8, hp: 5});

    // Тик кровотечения принадлежит жертве: источник смерти — она сама.
    runIntent(state, {
      type: 'DAMAGE',
      entityId: victim.id,
      sourceEntityId: victim.id,
      damage: 10,
      tags: ['damage.internal.bleeding'],
    });

    expect(victim.isAlive).toBe(false);
    // Минус «Чужой урожай» (reach: global — смерть вдали от владельца): −1 AP.
    // Плюс не сработал: иначе AP вернулся бы обратно до 1.
    expect(player.ap).toBe(0);
  });
});

describe('Разрыватель — детонация от ваншота (модель 1)', () => {
  beforeEach(() => {
    loadTestContent();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('ваншот сырорезом свежего врага детонирует: урон всем рядом, включая владельца, выжившие кровоточат', () => {
    const {state, player} = setupStateWithRelic('relic_blood_rupture');
    createStartingEquipment(state, player, ['weapon_sword_splinter_blade']);

    // Свежий враг БЕЗ кровотечения: on-hit bleed смертельного удара виден
    // реакциям на ENTITY_DIED — детонация обязана сработать и от ваншота.
    const victim = makeEnemy({id: 'enemy_1', x: 6, y: 5, hp: 4, maxHp: 20, ap: 0});
    state.entities.set(victim.id, victim);
    // Свидетель в радиусе 1 от позиции смерти — переживает детонацию.
    const bystander = makeEnemy({id: 'enemy_2', x: 6, y: 6, hp: 20, maxHp: 20, ap: 0});
    state.entities.set(bystander.id, bystander);

    const sim = createTestSimulation(state);
    const playerHpBefore = player.hp;
    const bystanderHpBefore = bystander.hp;
    const result = sim.dispatch({type: 'ATTACK', entityId: player.id, dx: 1, dy: 0});

    expect(result.success).toBe(true);
    expect(victim.isAlive).toBe(false);

    // Детонация (минус): 4 внутреннего урона всем живым в радиусе 1 —
    // свидетелю и самому владельцу (селектор без excludeSelf).
    expect(bystander.hp).toBe(bystanderHpBefore - 4);
    expect(player.hp).toBe(playerHpBefore - 4);
    // Брызги (плюс): выживший свидетель подхватил кровотечение на 2 хода.
    expect(bystander.statusEffects.some((s) => s.type === 'bleeding' && s.duration === 2)).toBe(true);
  });
});
