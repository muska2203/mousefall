/**
 * Интеграционные тесты подключения контентных правил к боевому циклу.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  testWorldDamageMultiplier,
  setWorldContentRulesOverride,
  getWorldContentRules,
} from '../../../fixtures/content-rules';
import { ExecutionBuilder, ExecutionNode } from '@simulation/core-types.ts';
import type { GameEvent } from '@simulation/types.ts';
import { executeIntent } from '@simulation/systems/intents/execute-intent.ts';
import { getContentRule } from '../../../../src/simulation/content-rules/registry';
import * as randomModule from '../../../../src/utils/random';
import {
  makePlayer,
  makeEnemy,
  makeStateWithPlayerAndEntity,
} from '../../../fixtures/gameState';

vi.mock('../../../../src/utils/rng', () => ({
  createRNG: vi.fn((seed: number) => ({ seed, state: seed >>> 0 })),
  rngChance: vi.fn(),
}));

import { rngChance } from '../../../../src/utils/rng';

function findNodeByEventType(root: ExecutionNode, eventType: string): ExecutionNode | null {
  if (root.event.type === eventType) return root;
  for (const child of root.children) {
    const found = findNodeByEventType(child, eventType);
    if (found) return found;
  }
  return null;
}

describe('executeIntent + content rules integration', () => {
  beforeEach(() => {
    vi.mocked(rngChance).mockReturnValue(true);
    setWorldContentRulesOverride([
      ...getWorldContentRules(),
      testWorldDamageMultiplier,
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    setWorldContentRulesOverride(null);
  });

  describe('при включённом флаге', () => {
    it('модификатор увеличивает DAMAGE-интент (world_global_damage_multiply ×1.1)', () => {
      const player = makePlayer({ x: 5, y: 5 });
      const enemy = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
      const state = makeStateWithPlayerAndEntity(player, enemy);
      state.featureFlags.contentRulesEnabled = true;

      const builder = new ExecutionBuilder({
        type: 'ACTION_APPLIED',
        action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
      });

      executeIntent(
        state,
        {
          type: 'DAMAGE',
          entityId: enemy.id,
          sourceEntityId: player.id,
          damage: 10,
          tags: ['damage.physical.slashing'],
        },
        builder,
        builder.root,
      );

      const damageEvent = findNodeByEventType(builder.root, 'ENTITY_DAMAGED');
      expect(damageEvent?.event).toMatchObject({ damage: 11 });
      expect(enemy.hp).toBe(89);
    });

    it('реакция на огненный урон накладывает горение (fire_damage_ignites)', () => {
      const player = makePlayer({ x: 5, y: 5 });
      const enemy = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
      const state = makeStateWithPlayerAndEntity(player, enemy);
      state.featureFlags.contentRulesEnabled = true;

      const builder = new ExecutionBuilder({
        type: 'ACTION_APPLIED',
        action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
      });

      executeIntent(
        state,
        {
          type: 'DAMAGE',
          entityId: enemy.id,
          sourceEntityId: player.id,
          damage: 10,
          tags: ['damage.magical.fire'],
        },
        builder,
        builder.root,
      );

      const burning = enemy.statusEffects.find((e) => e.type === 'burning');
      expect(burning).toBeDefined();
      expect(burning!.duration).toBe(3);
    });

    it('пилотный модификатор огня ×1.5 комбинируется с мировым модификатором', () => {
      vi.mocked(rngChance).mockReturnValue(false);

      const player = makePlayer({ x: 5, y: 5 });
      player.activeRules.push({
        ...getContentRule('item_fire_damage_multiplier'),
        ownerContext: { type: 'entity', entityId: 'test_fire_item' },
      });

      const enemy = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
      const state = makeStateWithPlayerAndEntity(player, enemy);
      state.featureFlags.contentRulesEnabled = true;

      const builder = new ExecutionBuilder({
        type: 'ACTION_APPLIED',
        action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
      });

      executeIntent(
        state,
        {
          type: 'DAMAGE',
          entityId: enemy.id,
          sourceEntityId: player.id,
          damage: 10,
          tags: ['damage.magical.fire'],
        },
        builder,
        builder.root,
      );

      const damageEvent = findNodeByEventType(builder.root, 'ENTITY_DAMAGED');
      expect(damageEvent?.event).toMatchObject({ damage: 17 });
      expect(enemy.hp).toBe(83);
      expect(enemy.statusEffects.some((e) => e.type === 'burning')).toBe(false);
    });

    it('при провале шанса реакции горение не накладывается', () => {
      vi.mocked(rngChance).mockReturnValue(false);

      const player = makePlayer({ x: 5, y: 5 });
      const enemy = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
      const state = makeStateWithPlayerAndEntity(player, enemy);
      state.featureFlags.contentRulesEnabled = true;

      const builder = new ExecutionBuilder({
        type: 'ACTION_APPLIED',
        action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
      });

      executeIntent(
        state,
        {
          type: 'DAMAGE',
          entityId: enemy.id,
          sourceEntityId: player.id,
          damage: 10,
          tags: ['damage.magical.fire'],
        },
        builder,
        builder.root,
      );

      expect(enemy.statusEffects.some((e) => e.type === 'burning')).toBe(false);
    });

    it('при full-chain появляются RULE_TRIGGERED как children событий', () => {
      const player = makePlayer({ x: 5, y: 5 });
      const enemy = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
      const state = makeStateWithPlayerAndEntity(player, enemy);
      state.featureFlags.contentRulesEnabled = true;

      const builder = new ExecutionBuilder({
        type: 'ACTION_APPLIED',
        action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
      });

      executeIntent(
        state,
        {
          type: 'DAMAGE',
          entityId: enemy.id,
          sourceEntityId: player.id,
          damage: 10,
          tags: ['damage.magical.fire'],
        },
        builder,
        builder.root,
      );

      const damageNode = findNodeByEventType(builder.root, 'ENTITY_DAMAGED');
      expect(damageNode).not.toBeNull();

      const ruleNode = damageNode!.children.find((child) => child.event.type === 'RULE_TRIGGERED');
      expect(ruleNode).toBeDefined();

      const ruleEvent = ruleNode!.event as Extract<GameEvent, { type: 'RULE_TRIGGERED' }>;
      expect(ruleEvent.ruleId).toBe('fire_damage_ignites');
      expect(ruleEvent.layer).toBe('world');
      expect(ruleEvent.conditionMatched).toBe(true);
      expect(ruleEvent.intents.some((intent) => intent.type === 'APPLY_STATUS')).toBe(true);
    });
  });

  describe('при выключенном флаге', () => {
    it('новая система не срабатывает: урон не умножается, горение не накладывается', () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1);

      try {
        const player = makePlayer({ x: 5, y: 5 });
        const enemy = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
        const state = makeStateWithPlayerAndEntity(player, enemy);
        state.featureFlags.contentRulesEnabled = false;

        const builder = new ExecutionBuilder({
          type: 'ACTION_APPLIED',
          action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
        });

        executeIntent(
          state,
          {
            type: 'DAMAGE',
            entityId: enemy.id,
            sourceEntityId: player.id,
            damage: 10,
            tags: ['damage.magical.fire'],
          },
          builder,
          builder.root,
        );

        const damageEvent = findNodeByEventType(builder.root, 'ENTITY_DAMAGED');
        expect(damageEvent?.event).toMatchObject({ damage: 10 });
        expect(enemy.hp).toBe(90);
        expect(enemy.statusEffects.some((e) => e.type === 'burning')).toBe(false);
      } finally {
        randomSpy.mockRestore();
      }
    });

    it('пилотный модификатор не срабатывает при выключенном флаге', () => {
      vi.spyOn(randomModule, 'randomChance').mockReturnValue(false);

      const player = makePlayer({ x: 5, y: 5 });
      player.activeRules.push({
        ...getContentRule('item_fire_damage_multiplier'),
        ownerContext: { type: 'entity', entityId: 'test_fire_item' },
      });

      const enemy = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
      const state = makeStateWithPlayerAndEntity(player, enemy);
      state.featureFlags.contentRulesEnabled = false;

      const builder = new ExecutionBuilder({
        type: 'ACTION_APPLIED',
        action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
      });

      executeIntent(
        state,
        {
          type: 'DAMAGE',
          entityId: enemy.id,
          sourceEntityId: player.id,
          damage: 10,
          tags: ['damage.magical.fire'],
        },
        builder,
        builder.root,
      );

      const damageEvent = findNodeByEventType(builder.root, 'ENTITY_DAMAGED');
      expect(damageEvent?.event).toMatchObject({ damage: 10 });
      expect(enemy.hp).toBe(90);
      expect(enemy.statusEffects.some((e) => e.type === 'burning')).toBe(false);
    });
  });
});
