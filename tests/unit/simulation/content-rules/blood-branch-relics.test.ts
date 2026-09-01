/**
 * Тесты правил реликвий кровавой ветки (этап 3 плана
 * docs/plans/bleed-builds-implementation.md, §4.2 концепта).
 *
 * Проверяются РЕАЛЬНЫЕ правила из CONTENT_RULES (по образцу
 * blood-branch-modifiers.test.ts) — тест фиксирует текущие числа контента.
 * Числа черновые (балансный проход roadMap 1.4), при ребалансе правятся
 * вместе с правилами.
 *
 * Покрытие:
 * - relic_blood_leech_tick_heal (Пиявка, плюс): тик чужого bleeding рядом →
 *   heal 1; собственный тик не лечит; тик вне радиуса 1 не собирается.
 *   Минус Пиявки — statModifier шаблона (−5 maxHp), проверен отдельно.
 * - relic_blood_echo_heal_on_bleed_kill (плюс) / relic_blood_echo_bleed_faded
 *   (минус, reach: global): добивание кровоточащего лечит; спадание bleeding
 *   у любой сущности бьёт владельца; дот-килл плюс не активирует.
 * - relic_blood_reaper_harvest (плюс) / relic_blood_reaper_foreign_harvest
 *   (минус, reach: global): зеркальная пара на ENTITY_DIED; дот-килл
 *   активирует минус и НЕ активирует плюсы (атрибуция: тик принадлежит жертве).
 * - relic_blood_fuel_self_tick (плюс) / relic_blood_fuel_exsanguinated (минус):
 *   тик собственного bleeding → +1 AP; спадание своего bleeding → −1 AP.
 * - relic_blood_rupture_detonation (минус) / relic_blood_rupture_bleed_splash
 *   (плюс): детонация бьёт всех живых в радиусе 1, включая владельца
 *   (без excludeSelf), труп исключён (allInRadius — только живые акторы).
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {getContentRule} from '../../../../src/simulation/content-rules/registry';
import {setWorldContentRulesOverride} from '../../../../src/simulation/content-rules/rules';
import {runContentRuleReactions} from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import type {GameEvent, Intent} from '../../../../src/simulation/core-types';
import type {ActiveRule} from '../../../../src/simulation/content-rules/types';
import type {Entity, EntityId, GameState} from '../../../../src/simulation/types';
import type {StatusTemplate} from '../../../../src/content/schemas';
import {resetRegistry} from '../../../../src/content/registry';
import {
  initObjectContentRegistry,
  makeEnemy,
  makeGameState,
  makePlayer,
  makeStateWithPlayerAndEntity,
} from '../../../fixtures/gameState';
import {relicBloodLeech} from '../../../../src/content/templates/relics/relic-blood-leech';
import {relicBloodEcho} from '../../../../src/content/templates/relics/relic-blood-echo';
import {relicBloodReaper} from '../../../../src/content/templates/relics/relic-blood-reaper';
import {relicBloodFuel} from '../../../../src/content/templates/relics/relic-blood-fuel';
import {relicBloodRupture} from '../../../../src/content/templates/relics/relic-blood-rupture';

/** Мок шаблона bleeding с реальной категорией контента (wound). */
function mockBleedingTemplate(): StatusTemplate {
  return {
    id: 'bleeding',
    ruleIds: [],
    statusCategory: 'wound',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    statModifiers: [],
  } as StatusTemplate;
}

/** Оборачивает реальное правило реестра в ActiveRule указанного владельца. */
function ownedRule(ruleId: string, ownerId: string): ActiveRule {
  return {
    ...getContentRule(ruleId),
    ownerContext: {type: 'entity', entityId: ownerId},
  };
}

function runReactions(state: GameState, event: GameEvent): Intent[] {
  const builder = new ExecutionBuilder(event);
  return runContentRuleReactions(state, event, builder, builder.root);
}

function makeBleeding(duration = 2) {
  return {type: 'bleeding' as const, duration, value: 0, statModifiers: null};
}

function makeTickedEvent(
  entityId: EntityId,
  overrides: Partial<Extract<GameEvent, {type: 'STATUS_TICKED'}>> = {},
): Extract<GameEvent, {type: 'STATUS_TICKED'}> {
  return {
    type: 'STATUS_TICKED',
    isFieldEvent: true,
    entityId,
    effectTypes: ['bleeding'],
    tags: ['status.bleeding'],
    ...overrides,
  };
}

function makeRemovedEvent(
  entityId: EntityId,
  effectType: 'bleeding' | 'poisoned' = 'bleeding',
): Extract<GameEvent, {type: 'STATUS_REMOVED'}> {
  return {
    type: 'STATUS_REMOVED',
    isFieldEvent: true,
    entityId,
    effectType,
  };
}

function makeDiedEvent(
  overrides: Partial<Extract<GameEvent, {type: 'ENTITY_DIED'}>> = {},
): Extract<GameEvent, {type: 'ENTITY_DIED'}> {
  return {
    type: 'ENTITY_DIED',
    isFieldEvent: true,
    entityId: 'enemy_test_1',
    position: {x: 6, y: 5},
    sourceEntityId: 'player',
    ...overrides,
  };
}

function makeStateOf(...entities: Entity[]): GameState {
  const player = entities.find((e) => e.id === 'player');
  return makeGameState({
    ...(player ? {player: player as never} : {}),
    entities: new Map<EntityId, Entity>(entities.map((e) => [e.id, e])),
  });
}

beforeEach(() => {
  initObjectContentRegistry({
    statuses: new Map([['bleeding', mockBleedingTemplate()]]),
  });
  // Мировые правила отключены: тест изолирует source-bound правила реликвий.
  setWorldContentRulesOverride([]);
});

afterEach(() => {
  setWorldContentRulesOverride(null);
  resetRegistry();
});

describe('шаблоны реликвий кровавой ветки — связка с правилами', () => {
  it('все ruleIds шаблонов ссылаются на существующие правила', () => {
    for (const template of [relicBloodLeech, relicBloodEcho, relicBloodReaper, relicBloodFuel, relicBloodRupture]) {
      for (const ruleId of template.ruleIds) {
        expect(() => getContentRule(ruleId), `${template.id} → ${ruleId}`).not.toThrow();
      }
    }
  });

  it('минус Пиявки — отрицательный statModifier (−5 maxHp), без правила', () => {
    expect(relicBloodLeech.ruleIds).toEqual(['relic_blood_leech_tick_heal']);
    expect(relicBloodLeech.statModifiers).toEqual([{stat: 'maxHp', value: -5, op: 'add'}]);
  });

  it('минус-правила помечены polarity: negative', () => {
    for (const ruleId of [
      'relic_blood_echo_bleed_faded',
      'relic_blood_reaper_foreign_harvest',
      'relic_blood_fuel_exsanguinated',
      'relic_blood_rupture_detonation',
    ]) {
      expect(getContentRule(ruleId).polarity, ruleId).toBe('negative');
    }
  });
});

describe('relic_blood_leech_tick_heal — Пиявка (плюс)', () => {
  it('тик чужого кровотечения рядом лечит владельца на 1 HP', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_leech_tick_heal', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5}); // радиус 1 от игрока
    enemy.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeTickedEvent(enemy.id));

    expect(intents).toEqual([{type: 'HEAL', entityId: player.id, amount: 1}]);
  });

  it('собственный тик владельца не лечит (not eventRole: target)', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_leech_tick_heal', 'player')]});
    player.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, makeEnemy({id: 'enemy_test_1', x: 8, y: 8}));

    const intents = runReactions(state, makeTickedEvent(player.id));

    expect(intents).toHaveLength(0);
  });

  it('тик чужого кровотечения вне радиуса 1 не собирается (слой radius)', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_leech_tick_heal', 'player')]});
    const farEnemy = makeEnemy({id: 'enemy_test_1', x: 1, y: 1}); // далеко от игрока (5,5)
    farEnemy.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, farEnemy);

    const intents = runReactions(state, makeTickedEvent(farEnemy.id));

    expect(intents).toHaveLength(0);
  });
});

describe('relic_blood_echo — Кровавое эхо', () => {
  it('плюс: добивание кровоточащего своим ударом лечит владельца на 2 HP', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_echo_heal_on_bleed_kill', 'player')]});
    const corpse = makeEnemy({id: 'enemy_test_1', x: 6, y: 5, isAlive: false});
    // Модель 1: статус, наложенный смертельным ударом, виден реакциям на ENTITY_DIED.
    corpse.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, corpse);

    const intents = runReactions(state, makeDiedEvent());

    expect(intents).toEqual([{type: 'HEAL', entityId: player.id, amount: 2}]);
  });

  it('плюс: дот-килл не активирует (источник смерти — сама жертва)', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_echo_heal_on_bleed_kill', 'player')]});
    const corpse = makeEnemy({id: 'enemy_test_1', x: 6, y: 5, isAlive: false});
    corpse.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, corpse);

    const intents = runReactions(state, makeDiedEvent({sourceEntityId: corpse.id}));

    expect(intents).toHaveLength(0);
  });

  it('минус: спадание bleeding у далёкой сущности бьёт владельца на 1 внутренний урон (reach: global)', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_echo_bleed_faded', 'player')]});
    const farEnemy = makeEnemy({id: 'enemy_test_1', x: 1, y: 1}); // вне слоя radius
    const state = makeStateWithPlayerAndEntity(player, farEnemy);

    const intents = runReactions(state, makeRemovedEvent(farEnemy.id));

    expect(intents).toEqual([expect.objectContaining({
      type: 'DAMAGE',
      entityId: player.id,
      damage: 1,
      tags: ['damage.internal.bleeding'],
    })]);
  });

  it('минус: спадание другого статуса не штрафует', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_echo_bleed_faded', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeRemovedEvent(enemy.id, 'poisoned'));

    expect(intents).toHaveLength(0);
  });

  it('минус: спадание bleeding у самого владельца тоже штрафует (любая сущность)', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_echo_bleed_faded', 'player')]});
    const state = makeStateWithPlayerAndEntity(player, makeEnemy({id: 'enemy_test_1', x: 8, y: 8}));

    const intents = runReactions(state, makeRemovedEvent(player.id));

    expect(intents).toEqual([expect.objectContaining({
      type: 'DAMAGE',
      entityId: player.id,
      damage: 1,
    })]);
  });
});

describe('relic_blood_reaper — Жатва', () => {
  it('плюс: добивание кровоточащего своим ударом возвращает 1 AP', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_reaper_harvest', 'player')]});
    const corpse = makeEnemy({id: 'enemy_test_1', x: 6, y: 5, isAlive: false});
    corpse.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, corpse);

    const intents = runReactions(state, makeDiedEvent());

    expect(intents).toEqual([{type: 'RESTORE_AP', entityId: player.id, amount: 1}]);
  });

  it('плюс: смерть кровоточащего от чужой руки не возвращает AP', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_reaper_harvest', 'player')]});
    const killer = makeEnemy({id: 'enemy_killer', x: 6, y: 6});
    const corpse = makeEnemy({id: 'enemy_test_1', x: 6, y: 5, isAlive: false});
    corpse.statusEffects.push(makeBleeding());
    const state = makeStateOf(player, killer, corpse);

    const intents = runReactions(state, makeDiedEvent({sourceEntityId: killer.id}));

    expect(intents).toHaveLength(0);
  });

  it('край: дот-килл кровоточащего активирует минус и НЕ активирует плюс', () => {
    const player = makePlayer({
      activeRules: [
        ownedRule('relic_blood_reaper_harvest', 'player'),
        ownedRule('relic_blood_reaper_foreign_harvest', 'player'),
        ownedRule('relic_blood_echo_heal_on_bleed_kill', 'player'),
      ],
    });
    const corpse = makeEnemy({id: 'enemy_test_1', x: 8, y: 8, isAlive: false}); // далеко — проверка reach: global у минуса
    corpse.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, corpse);

    // Тик кровотечения принадлежит жертве: источник смерти — она сама.
    const intents = runReactions(state, makeDiedEvent({
      sourceEntityId: corpse.id,
      position: {x: 8, y: 8},
    }));

    expect(intents).toEqual([{type: 'CONSUME_AP', entityId: player.id, amount: 1}]);
  });

  it('минус: смерть кровоточащего без источника (среда) тоже штрафует', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_reaper_foreign_harvest', 'player')]});
    const corpse = makeEnemy({id: 'enemy_test_1', x: 6, y: 5, isAlive: false});
    corpse.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, corpse);

    const intents = runReactions(state, makeDiedEvent({sourceEntityId: null}));

    expect(intents).toEqual([{type: 'CONSUME_AP', entityId: player.id, amount: 1}]);
  });

  it('минус: добивание владельцем не штрафует (eventRole: source)', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_reaper_foreign_harvest', 'player')]});
    const corpse = makeEnemy({id: 'enemy_test_1', x: 6, y: 5, isAlive: false});
    corpse.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, corpse);

    const intents = runReactions(state, makeDiedEvent());

    expect(intents).toHaveLength(0);
  });

  it('минус: смерть самого владельца не штрафует (not eventRole: target)', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_reaper_foreign_harvest', 'player')]});
    player.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, makeEnemy({id: 'enemy_test_1', x: 6, y: 5}));

    const intents = runReactions(state, makeDiedEvent({
      entityId: player.id,
      position: {x: player.x, y: player.y},
      sourceEntityId: 'enemy_test_1',
    }));

    expect(intents).toHaveLength(0);
  });
});

describe('relic_blood_fuel — Кровавое топливо', () => {
  it('плюс: тик собственного кровотечения возвращает 1 AP', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_fuel_self_tick', 'player')]});
    player.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, makeEnemy({id: 'enemy_test_1', x: 6, y: 5}));

    const intents = runReactions(state, makeTickedEvent(player.id));

    expect(intents).toEqual([{type: 'RESTORE_AP', entityId: player.id, amount: 1}]);
  });

  it('плюс: тик чужого кровотечения рядом не срабатывает (eventRole: target)', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_fuel_self_tick', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    enemy.statusEffects.push(makeBleeding());
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeTickedEvent(enemy.id));

    expect(intents).toHaveLength(0);
  });

  it('минус: спадание кровотечения владельца отнимает 1 AP', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_fuel_exsanguinated', 'player')]});
    const state = makeStateWithPlayerAndEntity(player, makeEnemy({id: 'enemy_test_1', x: 6, y: 5}));

    const intents = runReactions(state, makeRemovedEvent(player.id));

    expect(intents).toEqual([{type: 'CONSUME_AP', entityId: player.id, amount: 1}]);
  });

  it('минус: спадание кровотечения у чужой сущности не штрафует', () => {
    const player = makePlayer({activeRules: [ownedRule('relic_blood_fuel_exsanguinated', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeRemovedEvent(enemy.id));

    expect(intents).toHaveLength(0);
  });

  it('край: спадание bleeding на владельце двигает и Эхо-минус, и Топливо-минус', () => {
    const player = makePlayer({
      activeRules: [
        ownedRule('relic_blood_echo_bleed_faded', 'player'),
        ownedRule('relic_blood_fuel_exsanguinated', 'player'),
      ],
    });
    const state = makeStateWithPlayerAndEntity(player, makeEnemy({id: 'enemy_test_1', x: 6, y: 5}));

    const intents = runReactions(state, makeRemovedEvent(player.id));

    expect(intents).toContainEqual(expect.objectContaining({type: 'DAMAGE', entityId: player.id, damage: 1}));
    expect(intents).toContainEqual({type: 'CONSUME_AP', entityId: player.id, amount: 1});
    expect(intents).toHaveLength(2);
  });
});

describe('relic_blood_rupture — Разрыватель', () => {
  it('детонация бьёт всех живых в радиусе 1, включая владельца (без excludeSelf); труп исключён', () => {
    const player = makePlayer({
      activeRules: [
        ownedRule('relic_blood_rupture_detonation', 'player'),
        ownedRule('relic_blood_rupture_bleed_splash', 'player'),
      ],
    });
    const corpse = makeEnemy({id: 'enemy_test_1', x: 6, y: 5, isAlive: false});
    corpse.statusEffects.push(makeBleeding());
    const bystander = makeEnemy({id: 'enemy_bystander', x: 6, y: 6});
    const state = makeStateOf(player, corpse, bystander);

    const intents = runReactions(state, makeDiedEvent());

    const damageTargets = intents
      .filter((i) => i.type === 'DAMAGE')
      .map((i) => (i as Extract<Intent, {type: 'DAMAGE'}>).entityId)
      .sort();
    // Игрок (5,5) и свидетель (6,6) в радиусе 1 от позиции смерти (6,5); труп не бьётся.
    expect(damageTargets).toEqual([bystander.id, player.id].sort());
    for (const intent of intents.filter((i) => i.type === 'DAMAGE')) {
      expect(intent).toEqual(expect.objectContaining({damage: 4, tags: ['damage.internal.bleeding']}));
    }

    const bleedTargets = intents
      .filter((i) => i.type === 'APPLY_STATUS')
      .map((i) => (i as Extract<Intent, {type: 'APPLY_STATUS'}>).entityId)
      .sort();
    expect(bleedTargets).toEqual([bystander.id, player.id].sort());
  });

  it('reach: global — детонация срабатывает вдали от владельца; владелец вне радиуса не задет', () => {
    const player = makePlayer({
      x: 1,
      y: 1,
      activeRules: [
        ownedRule('relic_blood_rupture_detonation', 'player'),
        ownedRule('relic_blood_rupture_bleed_splash', 'player'),
      ],
    });
    const corpse = makeEnemy({id: 'enemy_test_1', x: 8, y: 8, isAlive: false});
    corpse.statusEffects.push(makeBleeding());
    const bystander = makeEnemy({id: 'enemy_bystander', x: 8, y: 7});
    const state = makeStateOf(player, corpse, bystander);

    const intents = runReactions(state, makeDiedEvent({position: {x: 8, y: 8}}));

    expect(intents).toContainEqual(expect.objectContaining({
      type: 'DAMAGE',
      entityId: bystander.id,
      damage: 4,
    }));
    expect(intents.some((i) => i.type === 'DAMAGE' && i.entityId === player.id)).toBe(false);
    expect(intents).toContainEqual(expect.objectContaining({
      type: 'APPLY_STATUS',
      entityId: bystander.id,
      status: expect.objectContaining({type: 'bleeding', duration: 2}),
    }));
  });

  it('смерть без кровотечения не детонирует', () => {
    const player = makePlayer({
      activeRules: [
        ownedRule('relic_blood_rupture_detonation', 'player'),
        ownedRule('relic_blood_rupture_bleed_splash', 'player'),
      ],
    });
    const corpse = makeEnemy({id: 'enemy_test_1', x: 6, y: 5, isAlive: false});
    const bystander = makeEnemy({id: 'enemy_bystander', x: 6, y: 6});
    const state = makeStateOf(player, corpse, bystander);

    const intents = runReactions(state, makeDiedEvent());

    expect(intents).toHaveLength(0);
  });
});
