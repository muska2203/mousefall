/**
 * Тесты глобального слоя сбора правил (план bleed-builds, этап 1.2;
 * решение §1 п. 4 docs/plans/bleed-builds-implementation.md).
 *
 * Правило с `reach: 'global'` собирается от всех живых акторов независимо
 * от дистанции до события (слой `global`, последний после `radius`).
 * Предназначено для on-death/on-remove правил реликвий кровавой ветки
 * (минусы «Жатвы» и «Кровавого эха»).
 *
 * Проверяет:
 * - срабатывание на событие в другом конце карты;
 * - что правило без reach на дистанции по-прежнему не собирается;
 * - дедупликацию: владелец, одновременно являющийся source события,
 *   не исполняет правило дважды;
 * - что труп с global-правилом не собирается (isAlive === false).
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {setWorldContentRulesOverride} from '../../../../src/simulation/content-rules/rules';
import {runContentRuleReactions} from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import type {GameEvent, Intent} from '../../../../src/simulation/core-types';
import type {ActiveRule, ContentRule} from '../../../../src/simulation/content-rules/types';
import type {GameState} from '../../../../src/simulation/types';
import type {Entity, EntityId} from '../../../../src/simulation/types';
import {resetRegistry} from '../../../../src/content/registry';
import {
  initObjectContentRegistry,
  makeEnemy,
  makeGameState,
  makePlayer,
} from '../../../fixtures/gameState';

/** Синтетическое on-death правило с глобальной досягаемостью: +1 AP владельцу. */
const testGlobalRestoreApOnDeath: ContentRule = {
  id: 'test_global_restore_ap_on_death',
  trigger: {event: 'ENTITY_DIED'},
  effect: {type: 'restoreAp', amount: 1},
  target: {type: 'self'},
  priority: 0,
  reach: 'global',
};

/** То же правило без reach — контроль дистанционного ограничения. */
const testLocalRestoreApOnDeath: ContentRule = {
  ...testGlobalRestoreApOnDeath,
  id: 'test_local_restore_ap_on_death',
  reach: undefined,
};

/** Оборачивает тестовое правило в ActiveRule указанного владельца. */
function ownedTestRule(rule: ContentRule, ownerId: string): ActiveRule {
  return {...rule, ownerContext: {type: 'entity', entityId: ownerId}};
}

function runReactions(state: GameState, event: GameEvent): Intent[] {
  const builder = new ExecutionBuilder(event);
  return runContentRuleReactions(state, event, builder, builder.root);
}

function makeDiedEvent(
  overrides: Partial<Extract<GameEvent, {type: 'ENTITY_DIED'}>> = {},
): Extract<GameEvent, {type: 'ENTITY_DIED'}> {
  return {
    type: 'ENTITY_DIED',
    isFieldEvent: true,
    entityId: 'enemy_corpse',
    position: {x: 8, y: 8},
    sourceEntityId: 'enemy_killer',
    ...overrides,
  };
}

describe('Слой global (reach: "global")', () => {
  beforeEach(() => {
    initObjectContentRegistry();
    // Мировые контентные правила отключены: тест изолирует слой global.
    setWorldContentRulesOverride([]);
  });

  afterEach(() => {
    setWorldContentRulesOverride(null);
    resetRegistry();
  });

  it('срабатывает на смерть в другом конце карты', () => {
    // Владелец правила в (1,1), смерть — в (8,8): вне слоя radius.
    const player = makePlayer({
      x: 1,
      y: 1,
      activeRules: [ownedTestRule(testGlobalRestoreApOnDeath, 'player')],
    });
    const killer = makeEnemy({id: 'enemy_killer', x: 8, y: 7});
    const corpse = makeEnemy({id: 'enemy_corpse', x: 8, y: 8, isAlive: false});
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [killer.id, killer],
        [corpse.id, corpse],
      ]),
    });

    const intents = runReactions(state, makeDiedEvent());

    expect(intents).toContainEqual(expect.objectContaining({
      type: 'RESTORE_AP',
      entityId: player.id,
      amount: 1,
    }));
  });

  it('правило без reach на дистанции не собирается', () => {
    const player = makePlayer({
      x: 1,
      y: 1,
      activeRules: [ownedTestRule(testLocalRestoreApOnDeath, 'player')],
    });
    const killer = makeEnemy({id: 'enemy_killer', x: 8, y: 7});
    const corpse = makeEnemy({id: 'enemy_corpse', x: 8, y: 8, isAlive: false});
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [killer.id, killer],
        [corpse.id, corpse],
      ]),
    });

    const intents = runReactions(state, makeDiedEvent());

    expect(intents).toHaveLength(0);
  });

  it('не исполняется дважды, когда владелец одновременно — source события (дедуп)', () => {
    // Владелец стоит рядом и сам убил цель: правило подхватывается слоем
    // source, а слой global обязан пропустить уже собранную копию.
    const player = makePlayer({
      x: 5,
      y: 5,
      activeRules: [ownedTestRule(testGlobalRestoreApOnDeath, 'player')],
    });
    const corpse = makeEnemy({id: 'enemy_corpse', x: 6, y: 5, isAlive: false});
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [corpse.id, corpse],
      ]),
    });

    const intents = runReactions(state, makeDiedEvent({
      position: {x: 6, y: 5},
      sourceEntityId: player.id,
    }));

    const restoreApIntents = intents.filter((i) => i.type === 'RESTORE_AP');
    expect(restoreApIntents).toHaveLength(1);
  });

  it('труп с global-правилом не собирается (isAlive === false)', () => {
    const player = makePlayer({x: 1, y: 1});
    const killer = makeEnemy({id: 'enemy_killer', x: 8, y: 7});
    // Второй труп владеет global-правилом — оно не должно сработать.
    const deadOwner = makeEnemy({
      id: 'enemy_dead_owner',
      x: 4,
      y: 4,
      isAlive: false,
      activeRules: [ownedTestRule(testGlobalRestoreApOnDeath, 'enemy_dead_owner')],
    });
    const corpse = makeEnemy({id: 'enemy_corpse', x: 8, y: 8, isAlive: false});
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [killer.id, killer],
        [deadOwner.id, deadOwner],
        [corpse.id, corpse],
      ]),
    });

    const intents = runReactions(state, makeDiedEvent());

    expect(intents).toHaveLength(0);
  });
});
