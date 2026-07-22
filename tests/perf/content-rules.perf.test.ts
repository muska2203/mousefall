/**
 * Benchmark harness для измерения производительности боевых цепочек content-rules.
 *
 * Цель WP6.5 «Проверка производительности»:
 * - детерминированные замеры типичных боевых сценариев;
 * - выявление узких мест без изменения логики симуляции;
 * - фиксация baseline для пост-MVP бэклога.
 *
 * Запуск:
 *   npm run test:perf
 *
 * Обычный набор тестов (`npm test`) НЕ запускает этот файл
 * благодаря исключению `tests/perf/**` в `vitest.config.ts`.
 */

import { describe, test, beforeAll, afterAll } from 'vitest';
import { performance } from 'node:perf_hooks';
import { GameSimulation } from '../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../src/content/registry';
import { initSkillRegistry } from '../../src/simulation/skills';
import {
  setContentRulesOverride,
  setWorldContentRulesOverride,
} from '../fixtures/content-rules';
import {
  makeGameState,
  makePlayer,
  makeEnemy,
  makeTestMap,
} from '../fixtures/gameState';
import { createTestSimulation } from '../helpers/simulation';
import { rebuildActiveRules } from '../../src/simulation/systems/rules/active-rule-lifecycle';
import { setContentRulesEnabled } from '../../src/simulation/content-rules/feature-flags';
import type {
  GameState,
  EnemyEntity,
  PlayerEntity,
  Position,
  Actor,
} from '../../src/simulation/types';
import type {
  ActiveRule,
  ContentRule,
  OwnerContext,
} from '../../src/simulation/content-rules/types';
import type {
  PlayerTemplate,
  AbilityTemplate,
  ItemTemplate,
  StatusTemplate,
} from '../../src/content/schemas';
import { createRNG } from '../../src/utils/rng';

// ─────────────────────────────────────────────────────────────────────────────
// Параметры замеров
// ─────────────────────────────────────────────────────────────────────────────

/** Фиксированный seed для детерминизма всех замеров. */
const SEED = 42;

/** Размер целевой карты по заданию WP6.5. */
const MAP_SIZE = 20;

/** Сколько раз повторять каждый сценарий для сбора статистики. */
const ITERATIONS = 100;

/** Позиция кастера (игрока). */
const CASTER_POS: Position = { x: 5, y: 5 };

/** Центр AoE-заклинания. */
const FIREBALL_TARGET: Position = { x: 10, y: 10 };

// ─────────────────────────────────────────────────────────────────────────────
// Реалистичные тестовые контентные правила (детерминированные аналоги
// существующих правил из global-rules.ts и counterattack-rules.ts).
// ─────────────────────────────────────────────────────────────────────────────

const burningOnDamageRule: ContentRule = {
  id: 'perf_burning_on_damage',
  trigger: { event: 'ENTITY_DAMAGED' },
  effect: {
    type: 'applyStatus',
    statusType: 'burning',
    duration: 3,
  },
  target: { type: 'eventTarget' },
  priority: 0,
};

const poisonOnDamageRule: ContentRule = {
  id: 'perf_poison_on_damage',
  trigger: { event: 'ENTITY_DAMAGED' },
  effect: {
    type: 'applyStatus',
    statusType: 'poisoned',
    duration: 3,
  },
  target: { type: 'eventTarget' },
  priority: 0,
};

const thornsRule: ContentRule = {
  id: 'perf_thorns',
  trigger: { event: 'ENTITY_DAMAGED' },
  effect: {
    type: 'dealDamage',
    amount: 3,
    tags: ['damage.physical.piercing'],
  },
  target: { type: 'eventSource' },
  priority: 0,
};

const lifeDrainRule: ContentRule = {
  id: 'perf_life_drain',
  trigger: { event: 'ENTITY_DAMAGED' },
  effect: {
    type: 'heal',
    amount: 2,
  },
  target: { type: 'self' },
  priority: 0,
};

const counterattackTriggerRule: ContentRule = {
  id: 'perf_counterattack_trigger',
  trigger: {
    event: 'ENTITY_DAMAGED',
    tags: ['attack.melee', 'target.single', 'delivery.weapon'],
  },
  effect: { type: 'counterAttack' },
  target: { type: 'eventSource' },
  priority: 0,
};

/** Все тестовые source/target правила, используемые в сценариях. */
const PERF_CONTENT_RULES: readonly ContentRule[] = [
  burningOnDamageRule,
  poisonOnDamageRule,
  thornsRule,
  lifeDrainRule,
  counterattackTriggerRule,
];

// ─────────────────────────────────────────────────────────────────────────────
// Мок-шаблоны контента, необходимые для симуляции
// ─────────────────────────────────────────────────────────────────────────────

const playerTemplate: PlayerTemplate = {
  id: 'perf_hero',
  portraitImg: '',
  renderScale: 1,
  maxAp: 2,
  baseStats: { str: 1, dex: 1, int: 10, vit: 1 },
  isDefault: false,
};

const fireballAbility: AbilityTemplate = {
  id: 'fireball',
  cooldown: 0,
  apCost: 1,
  aiPreparable: false,
  requiredWeaponTags: [],
  tags: ['attack.magical', 'target.aoe', 'damage.magical.fire'],
  ruleIds: [],
};

const perfWeapon: ItemTemplate = {
  id: 'perf_weapon',
  type: 'weapon',
  stackable: false,
  maxStack: 1,
  value: 0,
  rarity: 'common',
  abilityPool: [],
  equipModifiers: [],
  grantedAbilities: [],
  ruleIds: ['perf_burning_on_damage'],
  apCost: 1,
  weapon: {
    baseDamage: 10,
    damageFormulaId: 'sword',
    range: 1,
    damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
    tags: ['attack.melee', 'target.single', 'delivery.weapon'],
  },
};

const perfArmor: ItemTemplate = {
  id: 'perf_armor',
  type: 'armor',
  stackable: false,
  maxStack: 1,
  value: 0,
  rarity: 'common',
  abilityPool: [],
  equipModifiers: [],
  grantedAbilities: [],
  ruleIds: ['perf_poison_on_damage', 'perf_thorns'],
  apCost: 1,
  armor: { baseArmor: 2 },
};

const perfAmulet: ItemTemplate = {
  id: 'perf_amulet',
  type: 'amulet',
  stackable: false,
  maxStack: 1,
  value: 0,
  rarity: 'common',
  abilityPool: [],
  equipModifiers: [],
  grantedAbilities: [],
  ruleIds: ['perf_life_drain', 'perf_counterattack_trigger'],
  apCost: 1,
};

const perfAbility: AbilityTemplate = {
  id: 'perf_ability',
  cooldown: 0,
  apCost: 1,
  aiPreparable: false,
  requiredWeaponTags: [],
  tags: [],
  ruleIds: ['perf_burning_on_damage', 'perf_poison_on_damage'],
};

const perfStatusTemplates: StatusTemplate[] = [
  {
    id: 'burning',
    ruleIds: ['perf_thorns', 'perf_life_drain'],
    statusCategory: 'elemental',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
  },
  {
    id: 'poisoned',
    ruleIds: ['perf_thorns', 'perf_life_drain'],
    statusCategory: 'poison',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
  },
  {
    id: 'frozen',
    ruleIds: ['perf_thorns', 'perf_life_drain'],
    statusCategory: 'elemental',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
  },
  {
    id: 'stunned',
    ruleIds: ['perf_thorns', 'perf_life_drain'],
    statusCategory: 'mental',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
  },
  {
    id: 'dazed',
    ruleIds: ['perf_thorns', 'perf_life_drain'],
    statusCategory: 'mental',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные функции построения состояния
// ─────────────────────────────────────────────────────────────────────────────

/** Создаёт пустую карту заданного размера (пол внутри, стены по периметру). */
function makePerfMap(size: number) {
  return makeTestMap(size, size);
}

/** Создаёт игрока-катера с fireball. */
function makePerfPlayer(): PlayerEntity {
  return makePlayer({
    id: 'player',
    templateId: 'perf_hero',
    x: CASTER_POS.x,
    y: CASTER_POS.y,
    hp: 200,
    maxHp: 200,
    ap: 2,
    maxAp: 2,
    abilities: [
      {
        templateId: 'fireball',
        source: 'innate',
        level: 1,
        currentCooldown: 0,
      },
    ],
    inventory: [],
    equippedWeaponInstanceId: null,
    equippedArmorInstanceId: null,
    equippedAmuletInstanceId: null,
  });
}

/** Создаёт врага с заданным набором activeRules. */
function makePerfEnemy(
  id: string,
  x: number,
  y: number,
  rules: ActiveRule[],
): EnemyEntity {
  return makeEnemy({
    id,
    x,
    y,
    hp: 100,
    maxHp: 100,
    ap: 1,
    maxAp: 1,
    activeRules: rules,
    factionId: 'enemies',
  });
}

function makeOwnerContext(entityId: string): OwnerContext {
  return { type: 'entity', entityId };
}

/** Создаёт активное правило для прямой вставки в `actor.activeRules`. */
function makeActive(
  rule: ContentRule,
  ownerId: string,
): ActiveRule {
  return {
    ...rule,
    ownerContext: makeOwnerContext(ownerId),
  };
}

/** Набор из 3 реакций цели: горение, яд, шипы. */
function targetReactionRules(ownerId: string): ActiveRule[] {
  return [
    makeActive(burningOnDamageRule, ownerId),
    makeActive(poisonOnDamageRule, ownerId),
    makeActive(thornsRule, ownerId),
  ];
}

/** Набор из 5 реакций цели (плотная карта). */
function denseTargetReactionRules(ownerId: string): ActiveRule[] {
  return [
    makeActive(burningOnDamageRule, ownerId),
    makeActive(poisonOnDamageRule, ownerId),
    makeActive(thornsRule, ownerId),
    makeActive(lifeDrainRule, ownerId),
    makeActive(counterattackTriggerRule, ownerId),
  ];
}

/**
 * Создаёт базовое GameState: 20×20 карта, видимость полностью открыта,
 * детерминированный RNG, включённые content-rules.
 */
function makeBaseState(): GameState {
  const map = makePerfMap(MAP_SIZE);
  const visible = Array.from({ length: MAP_SIZE }, () =>
    Array(MAP_SIZE).fill(true) as boolean[],
  );
  const explored = Array.from({ length: MAP_SIZE }, () =>
    Array(MAP_SIZE).fill(true) as boolean[],
  );

  const player = makePerfPlayer();
  return {
    ...makeGameState(),
    map,
    visible,
    explored,
    player,
    entities: new Map([[player.id, player]]),
    rng: createRNG(SEED),
    runtimeRng: createRNG(SEED),
    featureFlags: { contentRulesEnabled: true },
  };
}

/** Добавляет врагов вокруг центра AoE. */
function addEnemiesAround(
  state: GameState,
  center: Position,
  count: number,
  ruleFactory: (ownerId: string) => ActiveRule[],
): void {
  const positions: Position[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 2, y: 0 },
  ];

  for (let i = 0; i < count; i++) {
    const offset = positions[i % positions.length]!;
    const id = `enemy_${i}`;
    const enemy = makePerfEnemy(
      id,
      center.x + offset.x,
      center.y + offset.y,
      ruleFactory(id),
    );
    state.entities.set(id, enemy);
  }
}

/** Собирает симуляцию с заданным количеством врагов. */
function buildSimulation(
  enemyCount: number,
  ruleFactory: (ownerId: string) => ActiveRule[],
): GameSimulation {
  const state = makeBaseState();
  addEnemiesAround(state, FIREBALL_TARGET, enemyCount, ruleFactory);
  const sim = createTestSimulation(state, false);
  setContentRulesEnabled(state, true);
  return sim;
}

// ─────────────────────────────────────────────────────────────────────────────
// Мини-измеритель
// ─────────────────────────────────────────────────────────────────────────────

type PerfSample = {
  scenario: string;
  iterations: number;
  minMs: number;
  medianMs: number;
  maxMs: number;
  meanMs: number;
  totalMs: number;
  notes: string;
};

/** Повторяет замер функции `fn`, возвращая агрегированную статистику. */
function measure(
  scenario: string,
  fn: () => void,
  iterations: number,
  notes = '',
): PerfSample {
  const samples: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    samples.push(end - start);
  }

  samples.sort((a, b) => a - b);
  const total = samples.reduce((sum, v) => sum + v, 0);
  const min = samples[0]!;
  const max = samples[samples.length - 1]!;
  const median = samples[Math.floor(samples.length / 2)]!;
  const mean = total / samples.length;

  return {
    scenario,
    iterations,
    minMs: min,
    medianMs: median,
    maxMs: max,
    meanMs: mean,
    totalMs: total,
    notes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Сценарии
// ─────────────────────────────────────────────────────────────────────────────

describe('WP6.5 — Проверка производительности content-rules', () => {
  const results: PerfSample[] = [];

  beforeAll(() => {
    initSkillRegistry();
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map([['perf_hero', playerTemplate]]),
      items: new Map([
        ['perf_weapon', perfWeapon],
        ['perf_armor', perfArmor],
        ['perf_amulet', perfAmulet],
      ]),
      abilities: new Map([
        ['fireball', fireballAbility],
        ['perf_ability', perfAbility],
      ]),
      statuses: new Map(perfStatusTemplates.map((s) => [s.id, s] as const)),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
    });
    // Подключаем тестовые source/target правила и отключаем глобальные мировые
    // правила, чтобы замер изолировал ровно те реакции, которые мы описали.
    setContentRulesOverride(PERF_CONTENT_RULES);
    setWorldContentRulesOverride([]);
  });

  afterAll(() => {
    resetRegistry();
    setContentRulesOverride(null);
    setWorldContentRulesOverride(null);

    // eslint-disable-next-line no-console
    console.log('\n=== WP6.5 Performance Results ===');
    // eslint-disable-next-line no-console
    console.table(
      results.map((r) => ({
        scenario: r.scenario,
        iterations: r.iterations,
        min_ms: r.minMs.toFixed(3),
        median_ms: r.medianMs.toFixed(3),
        max_ms: r.maxMs.toFixed(3),
        mean_ms: r.meanMs.toFixed(3),
        total_ms: r.totalMs.toFixed(2),
        notes: r.notes,
      })),
    );
  });

  test('a. Типичная цепочка: fireball на группу из 5 врагов (3 active rules each)', () => {
    const sim = buildSimulation(5, targetReactionRules);
    const action = {
      type: 'USE_ABILITY' as const,
      entityId: sim.getState().player.id,
      abilityId: 'fireball',
      targets: [FIREBALL_TARGET],
    };

    const sample = measure(
      'typical_chain_fireball_5_enemies',
      () => {
        // Каждый замер выполняем на свежей копии состояния, чтобы предыдущие
        // реакции (статусы, кулдауны, HP) не влияли на следующую итерацию.
        const fresh = buildSimulation(5, targetReactionRules);
        fresh.dispatch(action);
      },
      ITERATIONS,
      '5 целей в AoE fireball, у каждой 3 реакции: burning, poison, thorns',
    );
    results.push(sample);
  });

  test('b. Плотная карта: 10 врагов, 5 active rules each, AoE по всем', () => {
    const action = {
      type: 'USE_ABILITY' as const,
      entityId: 'player',
      abilityId: 'fireball',
      targets: [FIREBALL_TARGET],
    };

    const sample = measure(
      'dense_map_fireball_10_enemies',
      () => {
        const fresh = buildSimulation(10, denseTargetReactionRules);
        fresh.dispatch({ ...action, entityId: fresh.getState().player.id });
      },
      ITERATIONS,
      '10 целей в AoE, у каждой 5 реакций: burning, poison, thorns, lifeDrain, counterattack',
    );
    results.push(sample);
  });

  test('c. Сбор activeRules: многократный rebuild для актора с большим числом правил', () => {
    const state = makeBaseState();
    const player = state.player;

    // Экипируем предметы с правилами.
    player.inventory = [
      { instanceId: 'w1', templateId: 'perf_weapon', quantity: 1, grantedAbilities: [] },
      { instanceId: 'a1', templateId: 'perf_armor', quantity: 1, grantedAbilities: [] },
      { instanceId: 'm1', templateId: 'perf_amulet', quantity: 1, grantedAbilities: [] },
    ];
    player.equippedWeaponInstanceId = 'w1';
    player.equippedArmorInstanceId = 'a1';
    player.equippedAmuletInstanceId = 'm1';

    // Добавляем способность и несколько статусов.
    player.abilities = [
      { templateId: 'perf_ability', source: 'innate', level: 1, currentCooldown: 0 },
      { templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 },
    ];
    player.statusEffects = [
      { type: 'burning', duration: 3, value: 0, statModifiers: null, instanceId: 'status_1' },
      { type: 'poisoned', duration: 3, value: 0, statModifiers: null, instanceId: 'status_2' },
      { type: 'frozen', duration: 3, value: 0, statModifiers: null, instanceId: 'status_3' },
      { type: 'stunned', duration: 3, value: 0, statModifiers: null, instanceId: 'status_4' },
      { type: 'dazed', duration: 3, value: 0, statModifiers: null, instanceId: 'status_5' },
    ];

    const sample = measure(
      'rebuild_active_rules_actor',
      () => {
        // rebuild мутирует activeRules, поэтому повторный вызов измеряет
        // реальный cost пересборки от текущего состояния актора.
        rebuildActiveRules(player as Actor);
      },
      ITERATIONS * 10,
      'actor с экипировкой (3 предмета), 2 способностями и 5 статусами',
    );
    results.push(sample);
  });

  test('d. Селекторы: allInRadius / nearestEnemy на карте 20×20 со множеством сущностей', () => {
    const state = makeBaseState();
    // 100 дополнительных сущностей в случайных, но детерминированных позициях.
    for (let i = 0; i < 100; i++) {
      const id = `selector_target_${i}`;
      const x = 2 + (i % 16);
      const y = 2 + Math.floor(i / 16) % 16;
      const enemy = makePerfEnemy(id, x, y, []);
      state.entities.set(id, enemy);
    }

    const center: Position = { x: 10, y: 10 };
    const radius = 5;

    const allInRadius = () => {
      const result: string[] = [];
      for (const entity of state.entities.values()) {
        if (entity.id === state.player.id) continue;
        const dx = Math.abs(entity.x - center.x);
        const dy = Math.abs(entity.y - center.y);
        if (Math.max(dx, dy) <= radius) {
          result.push(entity.id);
        }
      }
      return result.sort((a, b) => a.localeCompare(b));
    };

    const nearestEnemy = () => {
      const player = state.player;
      let best: { id: string; distance: number } | null = null;
      for (const entity of state.entities.values()) {
        if (entity.id === player.id) continue;
        if ((entity as EnemyEntity).factionId === player.factionId) continue;
        const distance = Math.max(
          Math.abs(entity.x - center.x),
          Math.abs(entity.y - center.y),
        );
        if (distance > radius) continue;
        if (!best || distance < best.distance || (distance === best.distance && entity.id.localeCompare(best.id) < 0)) {
          best = { id: entity.id, distance };
        }
      }
      return best ? [best.id] : [];
    };

    const allSample = measure(
      'selector_allInRadius_20x20_100_entities',
      () => {
        allInRadius();
      },
      ITERATIONS * 10,
      'карта 20×20, 100 врагов, radius=5, Chebyshev distance',
    );

    const nearestSample = measure(
      'selector_nearestEnemy_20x20_100_entities',
      () => {
        nearestEnemy();
      },
      ITERATIONS * 10,
      'карта 20×20, 100 врагов, radius=5, ближайший враг',
    );

    results.push(allSample, nearestSample);
  });

  test('e. Debug vs release: накладные расходы content-rules (TODO RULE_TRIGGERED)', () => {
    const action = {
      type: 'USE_ABILITY' as const,
      entityId: 'player',
      abilityId: 'fireball',
      targets: [FIREBALL_TARGET],
    };

    const enabledSample = measure(
      'content_rules_enabled_overhead',
      () => {
        const fresh = buildSimulation(5, targetReactionRules);
        setContentRulesEnabled(fresh.getState(), true);
        fresh.dispatch({ ...action, entityId: fresh.getState().player.id });
      },
      ITERATIONS,
      'contentRulesEnabled=true',
    );

    const disabledSample = measure(
      'content_rules_disabled_overhead',
      () => {
        const fresh = buildSimulation(5, targetReactionRules);
        setContentRulesEnabled(fresh.getState(), false);
        fresh.dispatch({ ...action, entityId: fresh.getState().player.id });
      },
      ITERATIONS,
      'contentRulesEnabled=false (baseline без реакций)',
    );

    results.push(enabledSample, disabledSample);

    // TODO: после реализации WP6.2 (RULE_TRIGGERED) заменить это измерение
    // на сравнение dispatch с эмиссией RULE_TRIGGERED vs без неё.
    // eslint-disable-next-line no-console
    console.log(
      '[WP6.5] Примечание: событие RULE_TRIGGERED ещё не реализовано. ' +
        'Замер contentRulesEnabled=true/false дан как прокси-оценка накладных расходов observability.',
    );
  });
});
