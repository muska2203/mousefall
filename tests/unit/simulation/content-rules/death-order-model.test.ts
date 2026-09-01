/**
 * Тесты фиксации «модели 1» порядка смерти (план bleed-builds, этап 1.1;
 * решение §1 п. 2 docs/plans/bleed-builds-implementation.md).
 *
 * Модель 1: смерть — последнее, что происходит в волне. Все реакции на
 * смертельный урон (включая наложение on-hit статусов) разрешаются до
 * ENTITY_DIED, поэтому реакции на смерть видят финальное состояние цели,
 * включая только что наложенное. Статусы с трупа не снимаются
 * (ENTITY_DIED не порождает STATUS_REMOVED), труп остаётся в state.entities
 * до конца раунда, но не собирается слоем radius (isAlive === false).
 *
 * Код движка этими тестами не меняется — фиксируется текущее поведение.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {getContentRule} from '../../../../src/simulation/content-rules/registry';
import {setWorldContentRulesOverride} from '../../../../src/simulation/content-rules/rules';
import {runContentRuleReactions} from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import type {GameEvent, Intent} from '../../../../src/simulation/core-types';
import {executeIntent} from '../../../../src/simulation/systems/intents/execute-intent';
import type {ActiveRule, ContentRule} from '../../../../src/simulation/content-rules/types';
import type {GameState} from '../../../../src/simulation/types';
import type {StatusTemplate} from '../../../../src/content/schemas';
import {resetRegistry} from '../../../../src/content/registry';
import {testSlashingBleedRule} from '../../../fixtures/content-rules';
import {
  initObjectContentRegistry,
  makeEnemy,
  makePlayer,
  makeStateWithPlayerAndEntity,
} from '../../../fixtures/gameState';

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

/**
 * Синтетическое on-death правило: владелец лечится на 1, если убитая им цель
 * на момент ENTITY_DIED имеет кровотечение. По форме повторяет будущие
 * on-death правила кровавой ветки (плюс «Кровавого эха»).
 */
const testHealOnBleedingDeath: ContentRule = {
  id: 'test_heal_on_bleeding_death',
  trigger: {event: 'ENTITY_DIED'},
  conditions: [
    {type: 'eventRole', role: 'source'},
    {type: 'hasStatus', statusType: 'bleeding', subject: 'target'},
  ],
  effect: {type: 'heal', amount: 1},
  target: {type: 'self'},
  priority: 0,
};

/** Оборачивает реальное правило реестра в ActiveRule указанного владельца. */
function ownedRule(ruleId: string, ownerId: string): ActiveRule {
  return {...getContentRule(ruleId), ownerContext: {type: 'entity', entityId: ownerId}};
}

/** Оборачивает тестовое правило в ActiveRule указанного владельца. */
function ownedTestRule(rule: ContentRule, ownerId: string): ActiveRule {
  return {...rule, ownerContext: {type: 'entity', entityId: ownerId}};
}

function runReactions(state: GameState, event: GameEvent): Intent[] {
  const builder = new ExecutionBuilder(event);
  return runContentRuleReactions(state, event, builder, builder.root);
}

function makeBuilder() {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    isFieldEvent: false,
    action: {type: 'END_TURN', entityId: 'any'},
  });
}

describe('Порядок смерти (модель 1)', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      statuses: new Map([['bleeding', mockBleedingTemplate()]]),
    });
    // Мировые контентные правила отключены: тест изолирует source-bound правила.
    // Мировые РЕАКЦИИ (deathReaction) этим не затрагиваются и работают.
    setWorldContentRulesOverride([]);
  });

  afterEach(() => {
    setWorldContentRulesOverride(null);
    resetRegistry();
  });

  it('on-hit кровотечение смертельного удара видно реакциям на ENTITY_DIED (ваншот)', () => {
    const player = makePlayer({
      hp: 50,
      activeRules: [
        ownedRule('weapon_bleeding_on_hit', 'player'),
        ownedTestRule(testHealOnBleedingDeath, 'player'),
      ],
    });
    const enemy = makeEnemy({id: 'enemy_test_1', x: 6, y: 5, hp: 5});
    const state = makeStateWithPlayerAndEntity(player, enemy);

    // Один смертельный удар рубящим оружием: волна урона вешает кровотечение
    // (weapon_bleeding_on_hit) и порождает DIE; ENTITY_DIED эмитится следующей
    // волной, когда статус уже наложен.
    const builder = makeBuilder();
    executeIntent(
      state,
      {
        type: 'DAMAGE',
        entityId: enemy.id,
        sourceEntityId: player.id,
        damage: 10,
        tags: ['delivery.weapon', 'damage.physical.slashing'],
      },
      builder,
      builder.root,
    );

    // Ваншот: удар одновременно наложил кровотечение и убил.
    expect(enemy.isAlive).toBe(false);
    // Статусы с трупа не снимаются: bleeding остаётся на сущности.
    expect(enemy.statusEffects.some((s) => s.type === 'bleeding')).toBe(true);
    // Реакция на ENTITY_DIED увидела кровотечение на трупе и вылечила владельца.
    expect(player.hp).toBe(51);
  });

  it('труп с активным правилом не собирается radius-слоем последующих событий', () => {
    const player = makePlayer();
    const corpse = makeEnemy({
      id: 'enemy_corpse',
      x: 6,
      y: 5,
      isAlive: false,
      activeRules: [ownedTestRule(testSlashingBleedRule, 'enemy_corpse')],
    });
    const state = makeStateWithPlayerAndEntity(player, corpse);

    // Событие в клетке игрока: труп в радиусе 1, но isAlive === false
    // исключает его из слоя radius — его правило не должно сработать.
    const intents = runReactions(state, {
      type: 'ENTITY_DAMAGED',
      isFieldEvent: true,
      targetId: player.id,
      sourceEntityId: null,
      damage: 5,
      position: {x: player.x, y: player.y},
      tags: ['damage.physical.slashing'],
    });

    expect(intents).toHaveLength(0);
  });

  it('контроль: живой сосед с тем же правилом собирается radius-слоем', () => {
    const player = makePlayer();
    const neighbour = makeEnemy({
      id: 'enemy_neighbour',
      x: 6,
      y: 5,
      isAlive: true,
      activeRules: [ownedTestRule(testSlashingBleedRule, 'enemy_neighbour')],
    });
    const state = makeStateWithPlayerAndEntity(player, neighbour);

    const intents = runReactions(state, {
      type: 'ENTITY_DAMAGED',
      isFieldEvent: true,
      targetId: player.id,
      sourceEntityId: null,
      damage: 5,
      position: {x: player.x, y: player.y},
      tags: ['damage.physical.slashing'],
    });

    // Живой сосед подхвачен слоем radius: его правило наложило статус на цель события.
    expect(intents).toContainEqual(expect.objectContaining({
      type: 'APPLY_STATUS',
      entityId: player.id,
      status: expect.objectContaining({type: 'poisoned'}),
    }));
  });
});
