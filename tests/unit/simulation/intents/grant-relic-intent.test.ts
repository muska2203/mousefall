/**
 * Тесты исполнителя интента GRANT_RELIC (roadmap 0.2).
 *
 * Проверяет:
 * - выдачу реликвии: запись в коллекцию, событие RELIC_GRANTED;
 * - суммирование модификаторов по стакам (уникальный source на стак);
 * - регистрацию правил на каждый стак (уникальный ownerContext);
 * - сбор правил реликвий в rebuildActiveRules;
 * - отказы: нестакаемая повторно, лимит MAX_RELICS, не игрок, неизвестный шаблон;
 * - removeRelicFromPlayer и сброс коллекции в applyCharacterConfig.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {makeGameState, makePlayer, createObjectContent} from '../../../fixtures/gameState';
import {testSlashingBleedRule, withContentRules} from '../../../fixtures/content-rules';
import {
  executeGrantRelicIntent,
  relicModifierSource,
  removeRelicFromPlayer,
} from '../../../../src/simulation/systems/intents/grant-relic-intent-executor';
import {rebuildActiveRules} from '../../../../src/simulation/systems/rules/active-rule-lifecycle';
import {applyModifiers} from '../../../../src/simulation/systems/stats/modifier-engine';
import {applyCharacterConfig} from '../../../../src/simulation/characterCreation';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {RelicTemplate} from '../../../../src/content/schemas';
import {ExecutionBuilder} from '../../../../src/simulation/systems/actions/types';
import {MAX_RELICS} from '../../../../src/utils/constants';
import type {RelicInstance} from '../../../../src/simulation/types';

function mockRelic(
  id: string,
  overrides: Partial<RelicTemplate> = {},
): RelicTemplate {
  return {
    id,
    ruleIds: [],
    statModifiers: [],
    stackable: false,
    grantedAbilities: [],
    rarity: 'common',
    ...overrides,
  };
}

function makeBuilder() {
  return new ExecutionBuilder({ type: 'ACTION_APPLIED', isFieldEvent: false, action: { type: 'END_TURN', entityId: 'any' } });
}

function grant(state: ReturnType<typeof makeGameState>, templateId: string) {
  const builder = makeBuilder();
  return executeGrantRelicIntent(
    state,
    { type: 'GRANT_RELIC', entityId: 'player', templateId },
    builder,
    builder.root,
  );
}

beforeEach(() => {
  resetRegistry();
  initRegistry(createObjectContent({
    relics: new Map([
      ['relic_charm', mockRelic('relic_charm')],
      ['relic_blade', mockRelic('relic_blade', {
        stackable: true,
        statModifiers: [{ stat: 'damage', value: 2, op: 'add' }],
      })],
      ['relic_rule', mockRelic('relic_rule', {
        stackable: true,
        ruleIds: [testSlashingBleedRule.id],
      })],
    ]),
  }));
});

afterEach(() => {
  resetRegistry();
});

describe('executeGrantRelicIntent', () => {
  it('добавляет запись в коллекцию и возвращает событие RELIC_GRANTED', () => {
    const player = makePlayer();
    const state = makeGameState({ player, entities: new Map([['player', player]]) });

    const node = grant(state, 'relic_charm');

    expect(player.relics).toEqual([{ instanceId: 'relic_1', templateId: 'relic_charm' }]);
    expect(node).not.toBeNull();
    expect(node!.event).toMatchObject({
      type: 'RELIC_GRANTED',
      entityId: 'player',
      relicId: 'relic_charm',
      instanceId: 'relic_1',
    });
  });

  it('модификаторы стаков суммируются: уникальный source на каждый стак', () => {
    const player = makePlayer();
    const state = makeGameState({ player, entities: new Map([['player', player]]) });

    grant(state, 'relic_blade');
    grant(state, 'relic_blade');

    const damageMods = player.statModifiers.filter(m => m.stat === 'damage');
    expect(damageMods).toHaveLength(2);
    expect(damageMods.map(m => m.source)).toEqual([
      relicModifierSource('relic_1'),
      relicModifierSource('relic_2'),
    ]);
    expect(applyModifiers(player, 'damage', 10).total).toBe(14);
  });

  it('правила реликвии регистрируются на каждый стак и переживают rebuildActiveRules', () => {
    withContentRules([testSlashingBleedRule], () => {
      const player = makePlayer();
      const state = makeGameState({ player, entities: new Map([['player', player]]) });

      grant(state, 'relic_rule');
      grant(state, 'relic_rule');

      const ruleEntries = player.activeRules.filter(r => r.id === testSlashingBleedRule.id);
      expect(ruleEntries).toHaveLength(2);
      expect(ruleEntries.map(r => r.ownerContext)).toEqual([
        { type: 'entity', entityId: 'relic_1' },
        { type: 'entity', entityId: 'relic_2' },
      ]);

      rebuildActiveRules(player);
      const rebuilt = player.activeRules.filter(r => r.id === testSlashingBleedRule.id);
      expect(rebuilt).toHaveLength(2);
    });
  });

  it('отклоняет повторную выдачу нестакаемой реликвии', () => {
    const player = makePlayer();
    const state = makeGameState({ player, entities: new Map([['player', player]]) });

    expect(grant(state, 'relic_charm')).not.toBeNull();
    expect(grant(state, 'relic_charm')).toBeNull();
    expect(player.relics).toHaveLength(1);
  });

  it('отклоняет выдачу при достижении лимита MAX_RELICS', () => {
    const relics: RelicInstance[] = Array.from({ length: MAX_RELICS }, (_, i) => ({
      instanceId: `relic_${i + 1}`,
      templateId: 'relic_blade',
    }));
    const player = makePlayer({ relics });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });

    expect(grant(state, 'relic_charm')).toBeNull();
    expect(player.relics).toHaveLength(MAX_RELICS);
  });

  it('возвращает null для неизвестного шаблона', () => {
    const player = makePlayer();
    const state = makeGameState({ player, entities: new Map([['player', player]]) });

    expect(grant(state, 'relic_missing')).toBeNull();
    expect(player.relics).toEqual([]);
  });

  it('возвращает null, если сущность не является игроком', () => {
    const state = makeGameState();
    const builder = makeBuilder();

    const node = executeGrantRelicIntent(
      state,
      { type: 'GRANT_RELIC', entityId: 'nonexistent', templateId: 'relic_charm' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });
});

describe('removeRelicFromPlayer', () => {
  it('удаляет запись, модификаторы и правила экземпляра реликвии', () => {
    withContentRules([testSlashingBleedRule], () => {
      const player = makePlayer();
      const state = makeGameState({ player, entities: new Map([['player', player]]) });

      grant(state, 'relic_blade');
      grant(state, 'relic_rule');

      removeRelicFromPlayer(player, 'relic_1');

      expect(player.relics).toEqual([{ instanceId: 'relic_2', templateId: 'relic_rule' }]);
      expect(player.statModifiers.filter(m => m.stat === 'damage')).toHaveLength(0);
      expect(player.activeRules.filter(r => r.id === testSlashingBleedRule.id)).toHaveLength(1);
    });
  });
});

describe('applyCharacterConfig', () => {
  it('сбрасывает коллекцию реликвий при новом забеге', () => {
    const player = makePlayer({
      relics: [{ instanceId: 'relic_1', templateId: 'relic_charm' }],
    });

    applyCharacterConfig(player, {
      templateId: 'witcher',
      attributes: { strength: 1, agility: 1, vitality: 1, intelligence: 1, luck: 0 },
      startingEquipment: [],
    });

    expect(player.relics).toEqual([]);
  });
});
