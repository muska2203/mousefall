/**
 * Unit-тесты стратегии первого босса (guardian-boss).
 *
 * Проверяют приоритеты decideAction и переход стадий изолированно:
 * - исполнение подготовленной способности;
 * - запрет действий под «Глухой обороной» без сброса подготовки;
 * - одноразовый переход на стадию 2 и немедленное комбо;
 * - приоритет комбо над Налётом на стадии 2;
 * - подготовка Налёта только в конце хода и только при геометрии столкновения.
 *
 * Шаблон guardian_swoop — синтетический (независимость от балансного контента);
 * decideAction опирается на шаблон только через findCollisionLanding.
 */

import {beforeEach, describe, expect, it} from 'vitest';
import '@simulation/ai/guardian-boss-strategy';
import {getStrategy} from '@simulation/ai/strategy-registry';
import {ExecutionBuilder} from '@simulation/systems/actions/types';
import {initSkillRegistry} from '@simulation/skills';
import {initRegistry, resetRegistry} from '@content/registry';
import type {AbilityTemplate} from '@content/schemas';
import {createObjectContent, makeEnemy, makeGameState, makePlayer} from '../../../fixtures/gameState';
import type {EnemyEntity, Entity, EntityId, GameState} from '@simulation/types';

const SWOOP_ID = 'guardian_swoop';
const SLAM_ID = 'ground_slam';
const BULWARK_ID = 'bulwark';

function mockSwoopTemplate(): AbilityTemplate {
  return {
    id: SWOOP_ID,
    kind: 'swoop',
    jumpRadius: 3,
    aoeRadius: 1,
    baseDamage: 10,
    cooldown: 2,
    apCost: 2,
    aiPreparable: true,
    tags: ['delivery.ability', 'delivery.movement', 'attack.melee', 'target.aoe', 'effect.knockback'],
  } as AbilityTemplate;
}

beforeEach(() => {
  initSkillRegistry();
  resetRegistry();
  initRegistry(createObjectContent({
    abilities: new Map([[SWOOP_ID, mockSwoopTemplate()]]),
  }));
});

type BossOverrides = Partial<EnemyEntity>;

/** Босс с полным набором способностей (все кулдауны 0, если не указано иное). */
function makeBoss(overrides: BossOverrides = {}): EnemyEntity {
  return makeEnemy({
    id: 'boss_test',
    x: 4,
    y: 5,
    hp: 90,
    maxHp: 90,
    ap: 3,
    maxAp: 3,
    aiStrategyId: 'guardian-boss',
    aiSightRadius: 8,
    abilities: [
      {templateId: SWOOP_ID, source: 'innate', level: 1, currentCooldown: 0},
      {templateId: SLAM_ID, source: 'innate', level: 1, currentCooldown: 0},
      {templateId: BULWARK_ID, source: 'innate', level: 1, currentCooldown: 0},
    ],
    aiState: {
      strategy: 'guardian-boss',
      mode: 'chase',
      targetX: 5,
      targetY: 5,
      homeX: 4,
      homeY: 5,
      preparedAbility: null,
    },
    ...overrides,
  });
}

function makeStateWith(boss: EnemyEntity, player: {x: number; y: number}): GameState {
  const playerEntity = makePlayer({x: player.x, y: player.y});
  return makeGameState({
    player: playerEntity,
    entities: new Map<EntityId, Entity>([
      [playerEntity.id, playerEntity],
      [boss.id, boss],
    ]),
  });
}

function makeBuilder(entityId: string): ExecutionBuilder {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED', isFieldEvent: false,
    action: {type: 'END_TURN', entityId},
  });
}

const strategy = getStrategy('guardian-boss');

describe('guardian-boss decideAction', () => {
  it('под «Глухой обороной» только END_TURN, подготовка не сбрасывается', () => {
    const boss = makeBoss({
      statusEffects: [{type: 'bulwark', duration: 1, value: 0, statModifiers: null}],
    });
    boss.aiState.preparedAbility = {abilityId: SLAM_ID, targets: [{x: 4, y: 5}]};
    const state = makeStateWith(boss, {x: 5, y: 5});

    const action = strategy.decideAction(boss, state, null as unknown as ExecutionBuilder, null as never);

    expect(action.type).toBe('END_TURN');
    expect(boss.aiState.preparedAbility).not.toBeNull();
  });

  it('исполняет подготовленную способность с зафиксированными целями', () => {
    const boss = makeBoss();
    boss.aiState.preparedAbility = {abilityId: SLAM_ID, targets: [{x: 4, y: 5}]};
    const state = makeStateWith(boss, {x: 5, y: 5});

    const action = strategy.decideAction(boss, state, null as unknown as ExecutionBuilder, null as never);

    expect(action).toMatchObject({
      type: 'USE_ABILITY',
      entityId: boss.id,
      abilityId: SLAM_ID,
      targets: [{x: 4, y: 5}],
    });
  });

  it('переход на стадию 2: немедленное комбо «Удар + Оборона»', () => {
    const boss = makeBoss({hp: 40});
    const state = makeStateWith(boss, {x: 1, y: 1});

    strategy.updateState?.(boss, state);
    expect(boss.aiState.bossStage).toBe(2);
    expect(boss.aiState.bossTransitionPending).toBe(true);

    const builder = makeBuilder(boss.id);
    const action = strategy.decideAction(boss, state, builder, builder.root);

    expect(action).toMatchObject({type: 'USE_ABILITY', abilityId: BULWARK_ID});
    expect(boss.aiState.bossTransitionPending).toBe(false);
    expect(boss.aiState.preparedAbility).toEqual({
      abilityId: SLAM_ID,
      targets: [{x: boss.x, y: boss.y}],
    });
  });

  it('переход одноразовый: повторный updateState не поднимает флаг', () => {
    const boss = makeBoss({hp: 40});
    const state = makeStateWith(boss, {x: 1, y: 1});

    strategy.updateState?.(boss, state);
    boss.aiState.bossTransitionPending = false;

    strategy.updateState?.(boss, state);
    expect(boss.aiState.bossStage).toBe(2);
    expect(boss.aiState.bossTransitionPending).toBe(false);
  });

  it('переход не срабатывает выше порога 50% HP', () => {
    const boss = makeBoss({hp: 46});
    const state = makeStateWith(boss, {x: 1, y: 1});

    strategy.updateState?.(boss, state);
    expect(boss.aiState.bossStage).toBeUndefined();
    expect(boss.aiState.bossTransitionPending).toBeUndefined();
  });

  it('стадия 1: в конце хода готовит Налёт при геометрии столкновения', () => {
    const boss = makeBoss({ap: 1});
    const state = makeStateWith(boss, {x: 7, y: 5});
    // Стена за игроком — приземление (6,5) даёт столкновение.
    state.map.tiles[5]![8] = 'wall';

    const builder = makeBuilder(boss.id);
    const action = strategy.decideAction(boss, state, builder, builder.root);

    expect(action.type).toBe('END_TURN');
    expect(boss.aiState.preparedAbility).toEqual({
      abilityId: SWOOP_ID,
      targets: [{x: 6, y: 5}],
    });
  });

  it('стадия 1: без геометрии столкновения Налёт придерживается', () => {
    // Открытая карта: столкновение невозможно — обычная атака в ближнем бою.
    const boss = makeBoss({ap: 1});
    const state = makeStateWith(boss, {x: 5, y: 5});

    const builder = makeBuilder(boss.id);
    const action = strategy.decideAction(boss, state, builder, builder.root);

    expect(action.type).toBe('ATTACK');
    expect(boss.aiState.preparedAbility).toBeNull();
  });

  it('стадия 1: в середине хода (AP > 1) Налёт не готовится', () => {
    const boss = makeBoss({ap: 3});
    const state = makeStateWith(boss, {x: 5, y: 5});
    // Геометрия столкновения есть, но ход не закончен.
    state.map.tiles[5]![6] = 'wall';

    const builder = makeBuilder(boss.id);
    const action = strategy.decideAction(boss, state, builder, builder.root);

    expect(action.type).toBe('ATTACK');
    expect(boss.aiState.preparedAbility).toBeNull();
  });

  it('стадия 2: при AP > 1 и доступном комбо — преследование/атака', () => {
    const boss = makeBoss({ap: 3});
    boss.aiState.bossStage = 2;
    const state = makeStateWith(boss, {x: 5, y: 5});

    const builder = makeBuilder(boss.id);
    const action = strategy.decideAction(boss, state, builder, builder.root);

    expect(action.type).toBe('ATTACK');
    expect(boss.aiState.preparedAbility).toBeNull();
  });

  it('стадия 2: в конце хода комбо имеет приоритет над Налётом', () => {
    const boss = makeBoss({ap: 1});
    boss.aiState.bossStage = 2;
    const state = makeStateWith(boss, {x: 7, y: 5});
    // Геометрия столкновения для Налёта есть, но комбо важнее.
    state.map.tiles[5]![8] = 'wall';

    const builder = makeBuilder(boss.id);
    const action = strategy.decideAction(boss, state, builder, builder.root);

    expect(action).toMatchObject({type: 'USE_ABILITY', abilityId: BULWARK_ID});
    expect(boss.aiState.preparedAbility).toEqual({
      abilityId: SLAM_ID,
      targets: [{x: boss.x, y: boss.y}],
    });
  });

  it('стадия 2: комбо на кулдауне — Налёт заполняет окно', () => {
    const boss = makeBoss({ap: 1});
    boss.aiState.bossStage = 2;
    boss.abilities.find(a => a.templateId === SLAM_ID)!.currentCooldown = 2;
    boss.abilities.find(a => a.templateId === BULWARK_ID)!.currentCooldown = 2;
    const state = makeStateWith(boss, {x: 7, y: 5});
    state.map.tiles[5]![8] = 'wall';

    const builder = makeBuilder(boss.id);
    const action = strategy.decideAction(boss, state, builder, builder.root);

    expect(action.type).toBe('END_TURN');
    expect(boss.aiState.preparedAbility).toEqual({
      abilityId: SWOOP_ID,
      targets: [{x: 6, y: 5}],
    });
  });

  it('стадия 2: комбо не готовится при AP 0 (на каст Обороны не хватает AP)', () => {
    // Комбо доступно и ход окончен, но на каст Обороны нужен 1 AP — без него
    // подготовка Удара не выполняется.
    const boss = makeBoss({ap: 0, aiSightRadius: 2});
    boss.aiState.bossStage = 2;
    boss.aiState.mode = 'idle';
    const state = makeStateWith(boss, {x: 8, y: 8});

    const builder = makeBuilder(boss.id);
    const action = strategy.decideAction(boss, state, builder, builder.root);

    expect(action.type).toBe('END_TURN');
    expect(boss.aiState.preparedAbility).toBeNull();
  });

  it('без видимой цели действует по охотничьему FSM (idle → END_TURN)', () => {
    const boss = makeBoss({aiSightRadius: 2});
    boss.aiState.mode = 'idle';
    const state = makeStateWith(boss, {x: 8, y: 8});

    const builder = makeBuilder(boss.id);
    const action = strategy.decideAction(boss, state, builder, builder.root);

    expect(action.type).toBe('END_TURN');
    expect(boss.aiState.preparedAbility).toBeNull();
  });
});
