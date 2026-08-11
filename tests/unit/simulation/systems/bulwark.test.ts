/**
 * Unit-тесты семантики статуса «Глухая оборона» (bulwark) в движке.
 *
 * Проверяет:
 * - хелпер `isBulwarked`;
 * - обнуление урона в `applyDamageToEntity` (событие ENTITY_DAMAGED с damage 0 эмитится);
 * - гашение PUSH-интента без события.
 *
 * Сквозные сценарии (тики, столкновения, запрет действий) — в
 * `tests/integration/combat-scenarios/bulwark-scenario.test.ts`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isBulwarked } from '../../../../src/simulation/systems/bulwark-helper';
import { applyDamageToEntity } from '../../../../src/simulation/systems/damage/apply-damage';
import { executePushIntent } from '../../../../src/simulation/systems/intents/push-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { makeGameState, makeEnemy, initObjectContentRegistry } from '../../../fixtures/gameState';
import { resetRegistry } from '../../../../src/content/registry';
import type { EnemyEntity, GameState } from '../../../../src/simulation/types';

function makeBuilder() {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    isFieldEvent: false,
    action: { type: 'END_TURN', entityId: 'any' },
  });
}

function makeBulwarkedEnemy(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return makeEnemy({
    id: 'boss_test',
    x: 5,
    y: 5,
    hp: 90,
    maxHp: 90,
    armor: 0,
    statusEffects: [{ type: 'bulwark', duration: 1, value: 0, statModifiers: null }],
    ...overrides,
  });
}

function makeStateWith(boss: EnemyEntity): GameState {
  const state = makeGameState();
  state.entities.set(boss.id, boss);
  return state;
}

describe('isBulwarked', () => {
  it('распознаёт носителя bulwark и не срабатывает на другие статусы', () => {
    const boss = makeBulwarkedEnemy();
    expect(isBulwarked(boss)).toBe(true);

    const plain = makeEnemy({ statusEffects: [{ type: 'dazed', duration: 1, value: 0, statModifiers: null }] });
    expect(isBulwarked(plain)).toBe(false);

    expect(isBulwarked(null)).toBe(false);
    expect(isBulwarked({})).toBe(false);
  });
});

describe('applyDamageToEntity под bulwark', () => {
  beforeEach(() => {
    initObjectContentRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('обнуляет урон, но эмитит ENTITY_DAMAGED с damage 0', () => {
    const boss = makeBulwarkedEnemy();
    const state = makeStateWith(boss);
    const builder = makeBuilder();

    const node = applyDamageToEntity(state, boss, 15, ['damage.physical.blunt'], null, builder, builder.root);

    expect(boss.hp).toBe(90);
    expect(node.event).toMatchObject({ type: 'ENTITY_DAMAGED', damage: 0, targetId: boss.id });
  });

  it('без bulwark урон проходит как обычно', () => {
    const boss = makeBulwarkedEnemy({ statusEffects: [] });
    const state = makeStateWith(boss);
    const builder = makeBuilder();

    const node = applyDamageToEntity(state, boss, 15, ['damage.physical.blunt'], null, builder, builder.root);

    expect(boss.hp).toBe(75);
    expect(node.event).toMatchObject({ type: 'ENTITY_DAMAGED', damage: 15, targetId: boss.id });
  });

  it('обнуляет и магический урон (тики статусов, AoE)', () => {
    const boss = makeBulwarkedEnemy();
    const state = makeStateWith(boss);
    const builder = makeBuilder();

    applyDamageToEntity(state, boss, 9, ['damage.magical.fire'], null, builder, builder.root);

    expect(boss.hp).toBe(90);
  });
});

describe('PUSH под bulwark', () => {
  beforeEach(() => {
    initObjectContentRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('толчок гасится без события: носитель не сдвигается', () => {
    const boss = makeBulwarkedEnemy();
    const state = makeStateWith(boss);
    const builder = makeBuilder();

    const node = executePushIntent(
      state,
      { type: 'PUSH', entityId: boss.id, dx: 1, dy: 0, sourceEntityId: null },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
    expect(boss.x).toBe(5);
    expect(boss.y).toBe(5);
    expect(builder.root.children).toHaveLength(0);
  });

  it('без bulwark толчок сдвигает актора (ENTITY_DISPLACED)', () => {
    const rat = makeEnemy({ id: 'rat_test', x: 5, y: 5 });
    const state = makeStateWith(rat);
    const builder = makeBuilder();

    const node = executePushIntent(
      state,
      { type: 'PUSH', entityId: rat.id, dx: 1, dy: 0, sourceEntityId: null },
      builder,
      builder.root,
    );

    expect(node?.event).toMatchObject({ type: 'ENTITY_DISPLACED', entityId: rat.id });
  });
});
