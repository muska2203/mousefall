import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {makeGameState, makePlayer, makeEnemy} from '../../../fixtures/gameState';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {AbilityTemplate, EntityTemplate, ItemTemplate, ModifierTemplate, StatusTemplate} from '../../../../src/content/schemas';
import type {RuntimeAbility} from '../../../../src/simulation/core-types';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import {executeApplyStatusIntent} from '../../../../src/simulation/systems/intents/apply-status-intent-executer';
import {
  addActiveRulesForAbility,
  addActiveRulesForItem,
  addActiveRulesForStatus,
  rebuildActiveRules,
  removeActiveRulesForAbility,
  removeActiveRulesForItem,
  removeActiveRulesForStatus,
} from '../../../../src/simulation/systems/rules/active-rule-lifecycle';

function mockItem(id: string): ItemTemplate {
  return {
    id,
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    fixedModifiers: [],
    grantedAbilities: [],
    apCost: 1,
  };
}

/** Фирменный rule-модификатор тестового предмета: добавляет правило fire_damage_ignites. */
const testIgniteModifier: ModifierTemplate = {
  id: 'test_mod_ignite',
  effect: { kind: 'rule', ruleId: 'fire_damage_ignites' },
  scaling: { kind: 'none' },
  applicableSubtypes: ['sword'],
  polarity: 'positive',
  poolEligible: false,
  weight: 1,
};

/** Stat-модификатор без правила (для проверки, что stat-эффекты не дают activeRules). */
const testStatModifier: ModifierTemplate = {
  id: 'test_mod_stat',
  effect: { kind: 'stat', stat: 'maxHp', op: 'add' },
  scaling: { kind: 'fixed', value: 10 },
  applicableSubtypes: ['sword'],
  polarity: 'positive',
  poolEligible: false,
  weight: 1,
};

/** Минимальный шаблон врага с заданным списком модификаторов. */
function mockEntityTemplate(id: string, modifiers: string[] = []): EntityTemplate {
  return {
    id,
    health: { max: 10 },
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    attack: {
      damage: { min: 1, max: 1 },
      range: 1,
      minRange: 1,
      damageDistribution: [{ damageTag: 'damage.physical.blunt', weight: 1.0 }],
      tags: ['attack.melee', 'target.single', 'delivery.weapon'],
    },
    armor: 0,
    modifiers,
    abilities: [],
    lootTable: [],
    lootDropTable: [],
    aiSightRadius: 6,
    aiStrategyId: 'hunter',
    maxAp: 1,
    isBoss: false,
  } as EntityTemplate;
}

function mockAbility(id: string, ruleIds: string[] = []): AbilityTemplate {
  return {
    id,
    kind: 'fireball',
    range: 5,
    aoeRadius: 1,
    centerDamage: 20,
    aoeDamage: 10,
    cooldown: 0,
    apCost: 1,
    aiPreparable: false,
    requiredWeaponTags: [],
    tags: [],
    ruleIds,
  };
}

function mockStatus(id: string, ruleIds: string[] = []): StatusTemplate {
  return {
    id,
    ruleIds,
    statusCategory: 'generic',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    statModifiers: [],
  };
}

function makeBuilder() {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED', isFieldEvent: false,
    action: { type: 'END_TURN', entityId: 'any' },
  });
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    entities: new Map([
      ['test_enemy', mockEntityTemplate('test_enemy', ['test_mod_ignite'])],
      ['test_enemy_stat', mockEntityTemplate('test_enemy_stat', ['test_mod_stat'])],
    ]),
    players: new Map(),
    items: new Map([
      ['test_item', mockItem('test_item')],
    ]),
    modifiers: new Map([
      ['test_mod_ignite', testIgniteModifier],
      ['test_mod_stat', testStatModifier],
    ]),
    abilities: new Map([
      ['test_ability', mockAbility('test_ability', ['item_fire_damage_multiplier'])],
    ]),
    statuses: new Map([
      ['burning', mockStatus('burning', ['fire_damage_ignites'])],
    ]),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
  });
});

afterEach(() => {
  resetRegistry();
});

describe('active-rule-lifecycle', () => {
  it('добавляет и удаляет правила предмета', () => {
    const player = makePlayer();

    addActiveRulesForItem(player, 'item_1', ['fire_damage_ignites']);

    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.id).toBe('fire_damage_ignites');
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: 'item_1',
    });

    removeActiveRulesForItem(player, 'item_1');

    expect(player.activeRules).toHaveLength(0);
  });

  it('добавляет и удаляет правила статуса', () => {
    const player = makePlayer();

    addActiveRulesForStatus(player, 'status_inst_1', 'burning');

    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.id).toBe('fire_damage_ignites');
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: 'status_inst_1',
      statusInstanceId: 'status_inst_1',
    });

    removeActiveRulesForStatus(player, 'status_inst_1');

    expect(player.activeRules).toHaveLength(0);
  });

  it('добавляет и удаляет правила способности', () => {
    const player = makePlayer();
    const ability: RuntimeAbility = {
      templateId: 'test_ability',
      source: 'innate',
      level: 1,
      currentCooldown: 0,
    };

    addActiveRulesForAbility(player, ability);

    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.id).toBe('item_fire_damage_multiplier');
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: 'test_ability',
    });

    removeActiveRulesForAbility(player, ability);

    expect(player.activeRules).toHaveLength(0);
  });

  it('rebuildActiveRules собирает правила от экипировки, статусов и способностей', () => {
    const player = makePlayer({
      inventory: [
        {
          instanceId: 'item_1',
          templateId: 'test_item',
          quantity: 1,
          grantedAbilities: [],
          affixes: [{ modifierId: 'test_mod_ignite', value: null, origin: 'fixed' }],
        },
      ],
      equippedWeaponInstanceId: 'item_1',
      statusEffects: [
        {
          type: 'burning',
          duration: 3,
          value: 0,
          statModifiers: null,
          instanceId: 'status_inst_1',
        },
      ],
      abilities: [
        {
          templateId: 'test_ability',
          source: 'innate',
          level: 1,
          currentCooldown: 0,
        },
      ],
      activeRules: [],
    });

    rebuildActiveRules(player);

    expect(player.activeRules).toHaveLength(3);
    expect(
      player.activeRules.some(
        (r) =>
          r.ownerContext.type === 'entity' && r.ownerContext.entityId === 'item_1',
      ),
    ).toBe(true);
    expect(
      player.activeRules.some(
        (r) =>
          r.ownerContext.type === 'entity' &&
          r.ownerContext.entityId === 'status_inst_1',
      ),
    ).toBe(true);
    expect(
      player.activeRules.some(
        (r) =>
          r.ownerContext.type === 'entity' &&
          r.ownerContext.entityId === 'test_ability',
      ),
    ).toBe(true);
  });

  it('rebuildActiveRules не дублирует правила у игрока с inventory и equippedWeaponId', () => {
    const player = makePlayer({
      inventory: [
        {
          instanceId: 'item_1',
          templateId: 'test_item',
          quantity: 1,
          grantedAbilities: [],
          affixes: [{ modifierId: 'test_mod_ignite', value: null, origin: 'fixed' }],
        },
      ],
      equippedWeaponInstanceId: 'item_1',
      equippedWeaponId: 'test_item',
      activeRules: [],
    });

    rebuildActiveRules(player);

    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.id).toBe('fire_damage_ignites');
  });

  it('не дублирует правило от одного ownerContext, но сохраняет от разных', () => {
    const player = makePlayer();

    addActiveRulesForItem(player, 'item_1', ['fire_damage_ignites']);
    addActiveRulesForItem(player, 'item_1', ['fire_damage_ignites']);

    expect(player.activeRules).toHaveLength(1);

    addActiveRulesForItem(player, 'item_2', ['fire_damage_ignites']);

    expect(player.activeRules).toHaveLength(2);
    expect(
      player.activeRules.every((r) => r.id === 'fire_damage_ignites'),
    ).toBe(true);
  });

  it('не пересоздаёт activeRules при обновлении длительности статуса', () => {
    const player = makePlayer();
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });

    executeApplyStatusIntent(
      state,
      {
        type: 'APPLY_STATUS',
        entityId: player.id,
        sourceEntityId: null,
        status: {
          type: 'burning',
          duration: 3,
          value: 0,
          statModifiers: null,
        },
      },
      makeBuilder(),
      makeBuilder().root,
    );

    expect(player.statusEffects).toHaveLength(1);
    expect(player.activeRules).toHaveLength(1);

    const instanceId = player.statusEffects[0]!.instanceId;
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: instanceId,
      statusInstanceId: instanceId,
    });

    executeApplyStatusIntent(
      state,
      {
        type: 'APPLY_STATUS',
        entityId: player.id,
        sourceEntityId: null,
        status: {
          type: 'burning',
          duration: 5,
          value: 0,
          statModifiers: null,
        },
      },
      makeBuilder(),
      makeBuilder().root,
    );

    expect(player.statusEffects).toHaveLength(1);
    expect(player.statusEffects[0]!.duration).toBe(5);
    expect(player.statusEffects[0]!.instanceId).toBe(instanceId);
    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: instanceId,
      statusInstanceId: instanceId,
    });
  });

  // ── Вражеская ветка rebuildActiveRules (модификаторы шаблона сущности) ─────

  it('rebuildActiveRules врага собирает ruleIds из modifiers шаблона', () => {
    const enemy = makeEnemy({ templateId: 'test_enemy' });

    rebuildActiveRules(enemy);

    expect(enemy.activeRules).toHaveLength(1);
    expect(enemy.activeRules[0]!.id).toBe('fire_damage_ignites');
    expect(enemy.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: 'modifier:test_mod_ignite',
    });
  });

  it('rebuildActiveRules врага не добавляет правила от stat-модификаторов шаблона', () => {
    const enemy = makeEnemy({ templateId: 'test_enemy_stat' });

    rebuildActiveRules(enemy);

    expect(enemy.activeRules).toHaveLength(0);
  });

  it('rebuildActiveRules врага без шаблона в реестре не падает и не добавляет правил', () => {
    const enemy = makeEnemy({ templateId: 'unknown_enemy' });

    rebuildActiveRules(enemy);

    expect(enemy.activeRules).toHaveLength(0);
  });
});
