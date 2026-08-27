/**
 * Тесты правил мечей линии Бойца (концепт этажа 1, §4.3; roadmap этажа 1, п. 2.1).
 *
 * В отличие от relic-rules.test.ts (механики на тестовых правилах), здесь
 * проверяются РЕАЛЬНЫЕ правила из CONTENT_RULES (как mousetrap.test.ts) —
 * тест фиксирует текущие числа контента. Числа черновые (балансный проход
 * roadMap 1.4), при ребалансе правятся вместе с правилами.
 *
 * Проверяет:
 * - `weapon_bleeding_on_hit`: кровотечение (3 хода) при ударе рубящим уроном
 *   (реакция на ENTITY_DAMAGED), фильтр по тегу урона, защита от self-hit;
 * - `weapon_bleeding_execute`: +3 урона оружием по кровоточащим целям
 *   (modifyDamage на DAMAGE-интенте), отсутствие дублирования из radius-слоя.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {getContentRule} from '../../../../src/simulation/content-rules/registry';
import {setWorldContentRulesOverride} from '../../../../src/simulation/content-rules/rules';
import {runContentRuleReactions} from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {applyIntentModifiers} from '../../../../src/simulation/content-rules/modifiers/apply-intent-modifiers';
import {buildRuleContext} from '../../../../src/simulation/content-rules/rule-context';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import type {GameEvent, Intent} from '../../../../src/simulation/core-types';
import type {ActiveRule} from '../../../../src/simulation/content-rules/types';
import type {GameState} from '../../../../src/simulation/types';
import type {StatusTemplate} from '../../../../src/content/schemas';
import {resetRegistry} from '../../../../src/content/registry';
import {
  initObjectContentRegistry,
  makeEnemy,
  makePlayer,
  makeStateWithPlayerAndEntity,
} from '../../../fixtures/gameState';

const BASE_DAMAGE = 10;

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
  return {...getContentRule(ruleId), ownerContext: {type: 'entity', entityId: ownerId}};
}

function runReactions(state: GameState, event: GameEvent): Intent[] {
  const builder = new ExecutionBuilder(event);
  return runContentRuleReactions(state, event, builder, builder.root);
}

function makeDamagedEvent(
  overrides: Partial<Extract<GameEvent, {type: 'ENTITY_DAMAGED'}>> = {},
): Extract<GameEvent, {type: 'ENTITY_DAMAGED'}> {
  return {
    type: 'ENTITY_DAMAGED',
    isFieldEvent: true,
    targetId: 'enemy_test_1',
    sourceEntityId: 'player',
    damage: 5,
    position: {x: 6, y: 5},
    tags: ['delivery.weapon', 'damage.physical.slashing'],
    ...overrides,
  };
}

function makeDamageIntent(
  overrides: Partial<Extract<Intent, {type: 'DAMAGE'}>> = {},
): Extract<Intent, {type: 'DAMAGE'}> {
  return {
    type: 'DAMAGE',
    entityId: 'enemy_test_1',
    sourceEntityId: 'player',
    damage: BASE_DAMAGE,
    tags: ['delivery.weapon', 'damage.physical.slashing'],
    ...overrides,
  };
}

function runDamageModifiers(
  state: GameState,
  intent: Extract<Intent, {type: 'DAMAGE'}>,
): Extract<Intent, {type: 'DAMAGE'}> {
  return applyIntentModifiers(state, intent, buildRuleContext(state, intent)) as Extract<Intent, {type: 'DAMAGE'}>;
}

describe('weapon_bleeding_on_hit — реакция на ENTITY_DAMAGED', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      statuses: new Map([['bleeding', mockBleedingTemplate()]]),
    });
    // Мировые правила отключены: тест изолирует именно source-bound правило.
    setWorldContentRulesOverride([]);
  });

  afterEach(() => {
    setWorldContentRulesOverride(null);
    resetRegistry();
  });

  it('рубящий удар владельца накладывает кровотечение на 3 хода', () => {
    const player = makePlayer({activeRules: [ownedRule('weapon_bleeding_on_hit', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intents = runReactions(state, makeDamagedEvent());

    expect(intents).toContainEqual(expect.objectContaining({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: expect.objectContaining({type: 'bleeding', duration: 3}),
    }));
  });

  it('не срабатывает на колющий и дробящий урон', () => {
    const player = makePlayer({activeRules: [ownedRule('weapon_bleeding_on_hit', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const piercing = runReactions(state, makeDamagedEvent({
      tags: ['delivery.weapon', 'damage.physical.piercing'],
    }));
    const blunt = runReactions(state, makeDamagedEvent({
      tags: ['delivery.weapon', 'damage.physical.blunt'],
    }));

    expect(piercing).toHaveLength(0);
    expect(blunt).toHaveLength(0);
  });

  it('не открывает кровотечение у владельца при ударе по нему (eventRole: source)', () => {
    const player = makePlayer({activeRules: [ownedRule('weapon_bleeding_on_hit', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    // Враг бьёт владельца правила рубящим оружием — владелец не должен
    // отравить сам себя своей копией правила (слои target/radius).
    const intents = runReactions(state, makeDamagedEvent({
      targetId: player.id,
      sourceEntityId: enemy.id,
      position: {x: player.x, y: player.y},
    }));

    expect(intents).toHaveLength(0);
  });
});

describe('weapon_bleeding_execute — modifyDamage по кровоточащим', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      statuses: new Map([['bleeding', mockBleedingTemplate()]]),
    });
    setWorldContentRulesOverride([]);
  });

  afterEach(() => {
    setWorldContentRulesOverride(null);
    resetRegistry();
  });

  it('+3 урона по цели с кровотечением', () => {
    const player = makePlayer({activeRules: [ownedRule('weapon_bleeding_execute', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    enemy.statusEffects.push({type: 'bleeding', duration: 2, value: 0, statModifiers: null});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const result = runDamageModifiers(state, makeDamageIntent());

    expect(result.damage).toBe(BASE_DAMAGE + 3);
  });

  it('без кровотечения на цели урон не меняется', () => {
    const player = makePlayer({activeRules: [ownedRule('weapon_bleeding_execute', 'player')]});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const result = runDamageModifiers(state, makeDamageIntent());

    expect(result.damage).toBe(BASE_DAMAGE);
  });

  it('копия правила у цели не дублирует модификатор (eventRole: source)', () => {
    const player = makePlayer({activeRules: [ownedRule('weapon_bleeding_execute', 'player')]});
    const enemy = makeEnemy({
      id: 'enemy_test_1',
      x: 6,
      y: 5,
      activeRules: [ownedRule('weapon_bleeding_execute', 'enemy_test_1')],
    });
    enemy.statusEffects.push({type: 'bleeding', duration: 2, value: 0, statModifiers: null});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    // Цель тоже владеет правилом, но она — target события: её копия из слоя
    // radius/target не должна примениться второй раз.
    const result = runDamageModifiers(state, makeDamageIntent());

    expect(result.damage).toBe(BASE_DAMAGE + 3);
  });

  it('входящий урон по кровоточащему владельцу не усиливается', () => {
    const player = makePlayer({activeRules: [ownedRule('weapon_bleeding_execute', 'player')]});
    player.statusEffects.push({type: 'bleeding', duration: 2, value: 0, statModifiers: null});
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const result = runDamageModifiers(state, makeDamageIntent({
      entityId: player.id,
      sourceEntityId: enemy.id,
    }));

    expect(result.damage).toBe(BASE_DAMAGE);
  });
});
