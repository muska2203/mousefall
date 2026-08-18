/**
 * Unit-тесты семантики статуса «Обездвижен» (rooted) в движке.
 *
 * Проверяет:
 * - хелпер `isRooted`;
 * - отклонение MOVE в валидации действия (reasonCode 'actor_rooted');
 * - пустые цели/интенты рывка (dash) и прыжка (swoop) у обездвиженного кастера;
 * - прохождение PUSH по обездвиженному актору (внешнее перемещение не блокируется);
 * - блокировку игрового телепорта (TELEPORT_ENTITY) и проход системного (ignoreRooted);
 * - тик и спадание rooted по истечении длительности (TICK_STATUS_EFFECTS);
 * - поведение hunter-AI: атака только по соседней видимой цели, иначе END_TURN.
 *
 * Сквозные сценарии — в `tests/integration/combat-scenarios/rooted-scenario.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { isRooted } from '../../../../src/simulation/systems/rooted-helper';
import { moveEntity } from '../../../../src/simulation/systems/actions/movement-action';
import { executePushIntent } from '../../../../src/simulation/systems/intents/push-intent-executer';
import { executeTeleportEntityIntent } from '../../../../src/simulation/systems/intents/teleport-entity-intent-executor';
import { executeTickStatusEffectsIntent } from '../../../../src/simulation/systems/intents/tick-status-effects-intent-executer';
import { createDashSkill } from '../../../../src/simulation/skills/executors/dashSkill';
import { createSwoopSkill } from '../../../../src/simulation/skills/executors/swoopSkill';
import { decideHunterAction } from '../../../../src/simulation/ai/ai-helpers';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { makeGameState, makeEnemy, makePlayer, makeTestMap } from '../../../fixtures/gameState';
import type { EnemyEntity, Entity, EntityId, GameState, StatusEffect } from '../../../../src/simulation/types';

function rootedEffect(duration = 2): StatusEffect {
  return { type: 'rooted', duration, value: 0, statModifiers: null };
}

function makeBuilder() {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    isFieldEvent: false,
    action: { type: 'END_TURN', entityId: 'any' },
  });
}

function makeStateWith(...entities: Entity[]): GameState {
  const state = makeGameState({ map: makeTestMap() });
  for (const entity of entities) {
    state.entities.set(entity.id, entity);
  }
  return state;
}

describe('isRooted', () => {
  it('распознаёт носителя rooted и не срабатывает на другие статусы', () => {
    const rootedEnemy = makeEnemy({ statusEffects: [rootedEffect()] });
    expect(isRooted(rootedEnemy)).toBe(true);

    const dazedEnemy = makeEnemy({ statusEffects: [{ type: 'dazed', duration: 1, value: 0, statModifiers: null }] });
    expect(isRooted(dazedEnemy)).toBe(false);

    expect(isRooted(null)).toBe(false);
    expect(isRooted({})).toBe(false);
  });
});

describe('MOVE под rooted', () => {
  it('валидация отклоняет MOVE с reasonCode actor_rooted', () => {
    const enemy = makeEnemy({ x: 5, y: 5, statusEffects: [rootedEffect()] });
    const state = makeStateWith(enemy);

    const result = moveEntity.validate(state, { type: 'MOVE', entityId: enemy.id, dx: 1, dy: 0 });

    expect(result).toEqual({ ok: false, reasonCode: 'actor_rooted' });
  });

  it('без rooted валидация MOVE проходит', () => {
    const enemy = makeEnemy({ x: 5, y: 5 });
    const state = makeStateWith(enemy);

    const result = moveEntity.validate(state, { type: 'MOVE', entityId: enemy.id, dx: 1, dy: 0 });

    expect(result).toEqual({ ok: true });
  });
});

describe('dash под rooted', () => {
  const dash = createDashSkill({ id: 'dash', distance: 2, bumpDamage: 5 });

  it('нет валидных направлений рывка', () => {
    const enemy = makeEnemy({ x: 5, y: 5, statusEffects: [rootedEffect()] });
    const state = makeStateWith(enemy);

    expect(dash.getValidTargets(state, enemy)).toEqual([]);
  });

  it('resolve возвращает пустой список интентов', () => {
    const enemy = makeEnemy({ x: 5, y: 5, statusEffects: [rootedEffect()] });
    const state = makeStateWith(enemy);

    expect(dash.resolve(state, enemy, [{ x: 7, y: 5 }])).toEqual([]);
  });
});

describe('swoop под rooted', () => {
  const swoop = createSwoopSkill({ id: 'swoop', jumpRadius: 2, aoeRadius: 1, baseDamage: 8 });

  it('нет валидных точек приземления', () => {
    const enemy = makeEnemy({ x: 5, y: 5, statusEffects: [rootedEffect()] });
    const state = makeStateWith(enemy);

    expect(swoop.getValidTargets(state, enemy)).toEqual([]);
  });

  it('resolve возвращает пустой список интентов', () => {
    const enemy = makeEnemy({ x: 5, y: 5, statusEffects: [rootedEffect()] });
    const state = makeStateWith(enemy);

    expect(swoop.resolve(state, enemy, [{ x: 7, y: 5 }])).toEqual([]);
  });
});

describe('PUSH по обездвиженному актору', () => {
  it('толчок не блокируется: эмитится ENTITY_DISPLACED', () => {
    const enemy = makeEnemy({ x: 5, y: 5, statusEffects: [rootedEffect()] });
    const state = makeStateWith(enemy);
    const builder = makeBuilder();

    const node = executePushIntent(
      state,
      { type: 'PUSH', entityId: enemy.id, dx: 1, dy: 0, sourceEntityId: null },
      builder,
      builder.root,
    );

    expect(node?.event).toMatchObject({ type: 'ENTITY_DISPLACED', entityId: enemy.id });
  });
});

describe('тик rooted', () => {
  it('rooted тикает каждый ход и снимается по истечении длительности', () => {
    const enemy = makeEnemy({ x: 5, y: 5, statusEffects: [rootedEffect(2)] });
    const state = makeStateWith(enemy);
    const builder = makeBuilder();

    executeTickStatusEffectsIntent(
      state,
      { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' },
      builder,
      builder.root,
    );
    expect(enemy.statusEffects.find((e) => e.type === 'rooted')?.duration).toBe(1);

    executeTickStatusEffectsIntent(
      state,
      { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' },
      builder,
      builder.root,
    );
    expect(enemy.statusEffects.some((e) => e.type === 'rooted')).toBe(false);
    expect(isRooted(enemy)).toBe(false);

    const removed = builder.root.children
      .flatMap((node) => node.children)
      .find((node) => node.event.type === 'STATUS_REMOVED');
    expect(removed?.event).toMatchObject({ type: 'STATUS_REMOVED', effectType: 'rooted' });
  });
});

describe('TELEPORT под rooted', () => {
  it('игровой телепорт обездвиженного актора блокируется', () => {
    const enemy = makeEnemy({ x: 5, y: 5, statusEffects: [rootedEffect()] });
    const state = makeStateWith(enemy);
    const builder = makeBuilder();

    const node = executeTeleportEntityIntent(
      state,
      { type: 'TELEPORT_ENTITY', entityId: enemy.id, x: 8, y: 8 },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
    expect(enemy.x).toBe(5);
    expect(enemy.y).toBe(5);
  });

  it('системный телепорт с ignoreRooted проходит (переход между этажами)', () => {
    const enemy = makeEnemy({ x: 5, y: 5, statusEffects: [rootedEffect()] });
    const state = makeStateWith(enemy);
    const builder = makeBuilder();

    const node = executeTeleportEntityIntent(
      state,
      { type: 'TELEPORT_ENTITY', entityId: enemy.id, x: 8, y: 8, ignoreRooted: true },
      builder,
      builder.root,
    );

    expect(node?.event).toMatchObject({ type: 'ENTITY_MOVED', entityId: enemy.id, movementType: 'teleport' });
    expect(enemy.x).toBe(8);
    expect(enemy.y).toBe(8);
  });
});

describe('hunter AI под rooted', () => {
  function makeRootedHunter(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
    return makeEnemy({
      id: 'rooted_hunter',
      x: 5,
      y: 5,
      aiSightRadius: 6,
      statusEffects: [rootedEffect()],
      ...overrides,
    });
  }

  it('атакует видимого игрока в соседней клетке', () => {
    const player = makePlayer({ x: 6, y: 5 });
    const enemy = makeRootedHunter();
    const state = makeGameState({
      map: makeTestMap(),
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const action = decideHunterAction(enemy, state);

    expect(action).toMatchObject({ type: 'ATTACK', dx: 1, dy: 0 });
  });

  it('не двигается к видимой, но недосягаемой цели — END_TURN', () => {
    const player = makePlayer({ x: 8, y: 5 });
    const enemy = makeRootedHunter();
    const state = makeGameState({
      map: makeTestMap(),
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const action = decideHunterAction(enemy, state);

    expect(action.type).toBe('END_TURN');
  });

  it('в режиме chase не делает шагов — END_TURN', () => {
    const player = makePlayer({ x: 8, y: 8 });
    const enemy = makeRootedHunter({
      aiSightRadius: 1,
      aiState: {
        strategy: 'hunter',
        mode: 'chase',
        targetX: 7,
        targetY: 5,
        homeX: 5,
        homeY: 5,
        preparedAbility: null,
      },
    });
    const state = makeGameState({
      map: makeTestMap(),
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const action = decideHunterAction(enemy, state);

    expect(action.type).toBe('END_TURN');
  });
});
