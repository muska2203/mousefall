import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GameSimulation } from '../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../src/content/registry';
import type {
  ItemTemplate,
  AbilityTemplate,
  StatusTemplate,
  PlayerTemplate,
  DoorTemplate,
} from '../../src/content/schemas';
import { initSkillRegistry } from '../../src/simulation/skills/index';
import { defaultTestMapParams, makeEnemy } from '../fixtures/gameState';
import type { EnemyEntity } from '../../src/simulation/types';
import {
  testSlashingBleedRule,
  testStatusRestoreAp,
  testAbilityFireMultiplier,
  withContentRules,
  setContentRulesOverride,
  setWorldContentRulesOverride,
} from '../fixtures/content-rules';
import { setContentRulesEnabled } from '../../src/simulation/content-rules/feature-flags';
import { ExecutionBuilder } from '../../src/simulation/core-types';
import { executeIntent } from '../../src/simulation/systems/intents/execute-intent';
import type { RuntimeAbility } from '../../src/simulation/core-types';

function mockPlayerTemplate(id: string): PlayerTemplate {
  return {
    id,
    portraitImg: '',
    renderScale: 1,
    maxAp: 2,
    baseStats: { str: 1, dex: 1, int: 1, vit: 1 },
    isDefault: false,
  };
}

function mockWeapon(
  id: string,
  overrides: Partial<ItemTemplate> = {},
): ItemTemplate {
  return {
    id,
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    equipModifiers: [],
    grantedAbilities: [],
    ruleIds: [],
    apCost: 1,
    weapon: {
      baseDamage: 10,
      damageFormulaId: 'sword',
      range: 1,
      damageDistribution: [{ damageTag: 'damage.physical.slashing', weight: 1.0 }],
      tags: [],
    },
    ...overrides,
  };
}

function mockFireStaff(id: string): ItemTemplate {
  return {
    id,
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    equipModifiers: [],
    grantedAbilities: [],
    ruleIds: [],
    apCost: 1,
    weapon: {
      baseDamage: 10,
      damageFormulaId: 'staff',
      range: 1,
      damageDistribution: [{ damageTag: 'damage.magical.fire', weight: 1.0 }],
      tags: [],
    },
  };
}

function mockAbility(id: string, ruleIds: string[] = []): AbilityTemplate {
  return {
    id,
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
  };
}

function createEnemy(
  state: ReturnType<typeof GameSimulation.prototype.getState>,
  overrides: { id: string; x: number; y: number },
): EnemyEntity {
  const enemy = makeEnemy({
    id: overrides.id,
    x: overrides.x,
    y: overrides.y,
    hp: 50,
    maxHp: 50,
    ap: 0,
    maxAp: 2,
  });
  state.entities.set(enemy.id, enemy);
  return enemy;
}

beforeEach(() => {
  initSkillRegistry();
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map([['test_hero', mockPlayerTemplate('test_hero')]]),
    items: new Map([
      [
        'test_slashing_sword',
        mockWeapon('test_slashing_sword', {
          ruleIds: ['slashing_weapon_bleed'],
        }),
      ],
      ['test_fire_staff', mockFireStaff('test_fire_staff')],
    ]),
    abilities: new Map([
      ['test_talent', mockAbility('test_talent', ['ability_fire_multiplier'])],
    ]),
    statuses: new Map([
      ['poisoned', mockStatus('poisoned', ['status_restore_ap_on_damage'])],
    ]),
    maps: new Map(),
    doors: new Map([
      [
        'wooden_door',
        {
          id: 'wooden_door',
          maxHp: 30,
          armor: 2,
        } as DoorTemplate,
      ],
    ]),
    stairs: new Map(),
  });
});

afterEach(() => {
  resetRegistry();
  setContentRulesOverride(null);
  setWorldContentRulesOverride(null);
});

describe('Источники контентных правил', () => {
  it('правило предмета активируется при экипировке и срабатывает при уроне', () => {
    withContentRules([testSlashingBleedRule], () => {
      const simulation = GameSimulation.createNewGame(
        42,
        {
          templateId: 'test_hero',
          attributes: { strength: 1, agility: 1, vitality: 1, intelligence: 1, luck: 1 },
          startingEquipment: ['test_slashing_sword'],
        },
        defaultTestMapParams,
      );
      const state = simulation.getState();
      setContentRulesEnabled(state, true);

      // Правило меча должно попасть в activeRules игрока.
      expect(
        state.player.activeRules.some((rule) => rule.id === 'slashing_weapon_bleed'),
      ).toBe(true);

      const enemy = createEnemy(state, {
        id: 'enemy_1',
        x: state.player.x + 1,
        y: state.player.y,
      });
      const enemyHpBefore = enemy.hp;

      const result = simulation.dispatch({
        type: 'ATTACK',
        entityId: state.player.id,
        dx: 1,
        dy: 0,
      });
      expect(result.success).toBe(true);

      // Враг получил урон, а правило меча наложило яд.
      expect(enemy.hp).toBeLessThan(enemyHpBefore);
      expect(
        enemy.statusEffects.some((effect) => effect.type === 'poisoned'),
      ).toBe(true);
    });
  });

  it('правило статуса срабатывает при получении урона владельцем', () => {
    withContentRules([testStatusRestoreAp], () => {
      const simulation = GameSimulation.createNewGame(
        42,
        {
          templateId: 'test_hero',
          attributes: { strength: 1, agility: 1, vitality: 1, intelligence: 1, luck: 1 },
          startingEquipment: ['test_slashing_sword'],
        },
        defaultTestMapParams,
      );
      const state = simulation.getState();
      setContentRulesEnabled(state, true);

      const enemy = createEnemy(state, {
        id: 'enemy_1',
        x: state.player.x + 1,
        y: state.player.y,
      });

      // Накладываем на врага статус с правилом восстановления AP.
      const builder = new ExecutionBuilder({
        type: 'ACTION_APPLIED',
        action: { type: 'END_TURN', entityId: state.player.id },
      });
      executeIntent(
        state,
        {
          type: 'APPLY_STATUS',
          entityId: enemy.id,
          sourceEntityId: null,
          status: {
            type: 'poisoned',
            duration: 3,
            value: 0,
            statModifiers: null,
          },
        },
        builder,
        builder.root,
      );

      expect(
        enemy.activeRules.some((rule) => rule.id === 'status_restore_ap_on_damage'),
      ).toBe(true);

      enemy.ap = 0;
      const result = simulation.dispatch({
        type: 'ATTACK',
        entityId: state.player.id,
        dx: 1,
        dy: 0,
      });
      expect(result.success).toBe(true);

      // Правило статуса должно восстановить AP владельцу до максимума.
      expect(enemy.ap).toBe(enemy.maxAp);
    });
  });

  it('правило способности модифицирует урон при активации', () => {
    withContentRules([testAbilityFireMultiplier], () => {
      const simulation = GameSimulation.createNewGame(
        42,
        {
          templateId: 'test_hero',
          attributes: { strength: 1, agility: 1, vitality: 1, intelligence: 1, luck: 1 },
          startingEquipment: ['test_fire_staff'],
        },
        defaultTestMapParams,
      );
      const state = simulation.getState();
      setContentRulesEnabled(state, true);

      // Выдаём игроку способность-талант с правилом.
      const builder = new ExecutionBuilder({
        type: 'ACTION_APPLIED',
        action: { type: 'END_TURN', entityId: state.player.id },
      });
      const ability: RuntimeAbility = {
        templateId: 'test_talent',
        source: 'innate',
        level: 1,
        currentCooldown: 0,
      };
      executeIntent(
        state,
        {
          type: 'GRANT_ABILITY',
          entityId: state.player.id,
          ability,
        },
        builder,
        builder.root,
      );

      expect(
        state.player.activeRules.some((rule) => rule.id === 'ability_fire_multiplier'),
      ).toBe(true);

      const enemy = createEnemy(state, {
        id: 'enemy_1',
        x: state.player.x + 1,
        y: state.player.y,
      });
      const enemyHpBefore = enemy.hp;

      const result = simulation.dispatch({
        type: 'ATTACK',
        entityId: state.player.id,
        dx: 1,
        dy: 0,
      });
      expect(result.success).toBe(true);

      // Базовый урон посоха: round(10 + int*0.5) = round(10.5) = 11.
      // С модификатором ×2 от таланта: 22. Броня врага 0.
      expect(enemyHpBefore - enemy.hp).toBe(22);
    });
  });
});
