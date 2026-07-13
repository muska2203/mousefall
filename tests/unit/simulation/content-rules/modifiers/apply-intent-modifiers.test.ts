/**
 * Unit-тесты `applyIntentModifiers`.
 */

import { describe, it, expect } from 'vitest';
import { applyIntentModifiers } from '../../../../../src/simulation/content-rules/modifiers/apply-intent-modifiers';
import { buildRuleContext } from '../../../../../src/simulation/content-rules/rule-context';
import {
  makePlayer,
  makeEnemy,
  makeStateWithPlayerAndEntity,
} from '../../../../fixtures/gameState';
import type { Intent } from '../../../../../src/simulation/core-types';
import type { ActiveRule } from '../../../../../src/simulation/content-rules/types';

function makeModifierRule(overrides: Partial<ActiveRule> = {}): ActiveRule {
  return {
    id: 'test_modifier',
    trigger: { event: 'DAMAGE' },
    effect: { type: 'modifyDamage', op: 'multiply', value: 2 },
    target: { type: 'eventTarget' },
    priority: 0,
    ownerContext: { type: 'entity', entityId: 'item_1' },
    ...overrides,
  };
}

function makeDamageIntent(
  overrides: Partial<Extract<Intent, { type: 'DAMAGE' }>> = {},
): Extract<Intent, { type: 'DAMAGE' }> {
  return {
    type: 'DAMAGE',
    entityId: 'enemy_test_1',
    sourceEntityId: 'player',
    damage: 10,
    tags: ['damage.physical.slashing'],
    ...overrides,
  };
}

function runModifiers(state: ReturnType<typeof makeStateWithPlayerAndEntity>, intent: Intent): Intent {
  const ctx = buildRuleContext(state, intent);
  return applyIntentModifiers(state, intent, ctx);
}

function runDamageModifiers(
  state: ReturnType<typeof makeStateWithPlayerAndEntity>,
  intent: Extract<Intent, { type: 'DAMAGE' }>,
): Extract<Intent, { type: 'DAMAGE' }> {
  return runModifiers(state, intent) as Extract<Intent, { type: 'DAMAGE' }>;
}

describe('applyIntentModifiers', () => {
  it('множитель источника увеличивает урон', () => {
    const player = makePlayer({
      activeRules: [
        makeModifierRule({
          id: 'source_double_damage',
          trigger: { event: 'DAMAGE', tags: ['damage.magical.fire'] },
          effect: { type: 'modifyDamage', op: 'multiply', value: 2 },
        }),
      ],
    });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intent = makeDamageIntent({
      entityId: enemy.id,
      sourceEntityId: player.id,
      tags: ['damage.magical.fire'],
    });

    const result = runDamageModifiers(state, intent);

    // 10 * 2 (source) * 1.1 (мировое правило world_global_damage_multiply)
    expect(result.damage).toBeCloseTo(22, 10);
  });

  it('аддитивный модификатор цели увеличивает урон', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({
      id: 'enemy_test_1',
      x: 6,
      y: 5,
      activeRules: [
        makeModifierRule({
          id: 'target_add_damage',
          trigger: { event: 'DAMAGE', tags: ['damage.physical.slashing'] },
          effect: { type: 'modifyDamage', op: 'add', value: 5 },
        }),
      ],
    });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intent = makeDamageIntent({
      entityId: enemy.id,
      sourceEntityId: player.id,
    });

    const result = runDamageModifiers(state, intent);

    // (10 + 5) * 1.1
    expect(result.damage).toBeCloseTo(16.5, 10);
  });

  it('внутри слоя сначала применяется multiply, затем add', () => {
    const player = makePlayer({
      activeRules: [
        makeModifierRule({
          id: 'source_add',
          effect: { type: 'modifyDamage', op: 'add', value: 5 },
        }),
        makeModifierRule({
          id: 'source_multiply',
          effect: { type: 'modifyDamage', op: 'multiply', value: 2 },
        }),
      ],
    });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intent = makeDamageIntent({
      entityId: enemy.id,
      sourceEntityId: player.id,
    });

    const result = runDamageModifiers(state, intent);

    // (10 * 2 + 5) * 1.1
    expect(result.damage).toBeCloseTo(27.5, 10);
  });

  it('соблюдается порядок слоёв source → target → world → radius', () => {
    const player = makePlayer({
      x: 5,
      y: 5,
      activeRules: [
        makeModifierRule({
          id: 'source_layer',
          effect: { type: 'modifyDamage', op: 'multiply', value: 2, addTags: ['layer.source'] },
        }),
      ],
    });
    const enemy = makeEnemy({
      id: 'enemy_test_1',
      x: 6,
      y: 5,
      activeRules: [
        makeModifierRule({
          id: 'target_layer',
          effect: { type: 'modifyDamage', op: 'add', value: 0, addTags: ['layer.target'] },
        }),
      ],
    });
    const bystander = makeEnemy({
      id: 'enemy_bystander',
      x: 6,
      y: 6,
      activeRules: [
        makeModifierRule({
          id: 'radius_layer',
          effect: { type: 'modifyDamage', op: 'add', value: 0, addTags: ['layer.radius'] },
        }),
      ],
    });

    const state = makeStateWithPlayerAndEntity(player, enemy);
    state.entities.set(bystander.id, bystander);

    const intent = makeDamageIntent({
      entityId: enemy.id,
      sourceEntityId: player.id,
    });

    const result = runDamageModifiers(state, intent);

    // 10 * 2 (source) * 1.1 (world multiply) + 0 (world add) + 0 (target) + 0 (radius)
    expect(result.damage).toBeCloseTo(22, 10);
    expect(result.tags).toEqual([
      'damage.physical.slashing',
      'layer.source',
      'layer.target',
      'layer.world',
      'layer.radius',
    ]);
  });

  it('addTags добавляет теги к интенту', () => {
    const player = makePlayer({
      activeRules: [
        makeModifierRule({
          id: 'source_add_tag',
          effect: { type: 'modifyDamage', op: 'multiply', value: 2, addTags: ['bonus'] },
        }),
      ],
    });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intent = makeDamageIntent({
      entityId: enemy.id,
      sourceEntityId: player.id,
    });

    const result = runDamageModifiers(state, intent);

    expect(result.tags).toContain('bonus');
  });

  it('параметризованное значение читается из контекста (eventDamage)', () => {
    const player = makePlayer({
      activeRules: [
        makeModifierRule({
          id: 'source_context_add',
          effect: {
            type: 'modifyDamage',
            op: 'add',
            value: { type: 'context', field: 'eventDamage' },
          },
        }),
      ],
    });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intent = makeDamageIntent({
      entityId: enemy.id,
      sourceEntityId: player.id,
      damage: 10,
    });

    const result = runDamageModifiers(state, intent);

    // (10 + 10) * 1.1
    expect(result.damage).toBeCloseTo(22, 10);
  });

  it('неподдерживаемые интенты проходят без изменений', () => {
    const player = makePlayer();
    const state = makeStateWithPlayerAndEntity(player, makeEnemy());

    const intent: Intent = {
      type: 'MOVE',
      entityId: player.id,
      dx: 1,
      dy: 0,
    };

    const result = runModifiers(state, intent);

    expect(result).toEqual(intent);
  });

  it('не мутирует state', () => {
    const player = makePlayer({
      activeRules: [
        makeModifierRule({
          id: 'source_mutate_check',
          effect: { type: 'modifyDamage', op: 'multiply', value: 2 },
        }),
      ],
    });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);
    const before = structuredClone(state);

    const intent = makeDamageIntent({
      entityId: enemy.id,
      sourceEntityId: player.id,
    });

    runModifiers(state, intent);

    expect(state).toEqual(before);
  });

  it('условия модификаторов в фазе 2 не оцениваются (modifyDamage безусловен)', () => {
    const player = makePlayer({
      activeRules: [
        makeModifierRule({
          id: 'source_with_condition',
          conditions: [{ type: 'chance', probability: 0 }],
          effect: { type: 'modifyDamage', op: 'multiply', value: 2 },
        }),
      ],
    });
    const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, enemy);

    const intent = makeDamageIntent({
      entityId: enemy.id,
      sourceEntityId: player.id,
    });

    const result = runDamageModifiers(state, intent);

    expect(result.damage).toBeCloseTo(22, 10);
  });
});
