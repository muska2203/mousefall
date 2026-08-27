/**
 * Unit-тесты обобщённого self-buff исполнителя и разрешения по kind в getSkillExecutor.
 *
 * Проверяет:
 * - фабрику createSelfBuffSkill (target mode, цели, resolve → APPLY_STATUS на кастера);
 * - разрешение getSkillExecutor: шаблон с kind 'selfBuff' получает generic-исполнитель
 *   фабрикой по kind (с кэшированием), неизвестная способность — undefined;
 * - интеграцию каста: статус накладывается, кулдаун выставляется.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import { createSelfBuffSkill } from '../../../../src/simulation/skills/executors/selfBuffSkill';
import { getSkillExecutor } from '../../../../src/simulation/skills/skillExecutor';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate, StatusTemplate } from '../../../../src/content/schemas';
import { createTestSimulation } from '../../../helpers/simulation';

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 0,
    apCost: 1,
    tags: [],
    ...overrides,
  } as AbilityTemplate;
}

const mockBulwarkStatus: StatusTemplate = {
  id: 'bulwark',
  ruleIds: [],
  statusCategory: 'physical',
  categoryPriority: 0,
  mutuallyExclusiveWith: [],
  blockedBy: [],
  statModifiers: [],
};

function initMockRegistry(): void {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map([
      ['bulwark', mockAbility('bulwark', {
        kind: 'selfBuff',
        statusType: 'bulwark',
        duration: 1,
        cooldown: 4,
        apCost: 1,
        tags: ['delivery.ability', 'target.self', 'buff'],
      })],
    ]),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
    statuses: new Map([['bulwark', mockBulwarkStatus]]),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
  });
}

describe('createSelfBuffSkill', () => {
  it('resolve возвращает APPLY_STATUS на кастера с параметрами из фабрики', () => {
    const skill = createSelfBuffSkill({ id: 'bulwark', statusType: 'bulwark', duration: 1 });
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = skill.resolve(state, player, [{ x: 5, y: 5 }]);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: player.id,
      sourceEntityId: player.id,
      status: { type: 'bulwark', duration: 1 },
    });
    expect(intents[0]).not.toHaveProperty('status.stacks');
  });

  it('resolve возвращает пустой массив для не-актора', () => {
    const skill = createSelfBuffSkill({ id: 'bulwark', statusType: 'bulwark', duration: 1 });
    const state = makeGameState();
    const notActor = { id: 'box', type: 'floor_item_container', x: 1, y: 1 };

    expect(skill.resolve(state, notActor as never, [{ x: 1, y: 1 }])).toEqual([]);
  });

  it('имеет self target mode, единственную цель и зону на кастере', () => {
    const skill = createSelfBuffSkill({ id: 'bulwark', statusType: 'bulwark', duration: 1 });
    const state = makeGameState();
    const enemy = makeEnemy({ x: 6, y: 5 });

    expect(skill.getTargetMode(state, enemy)).toEqual({ type: 'self' });
    expect(skill.getValidTargets(state, enemy)).toEqual([{ x: 6, y: 5 }]);
    expect(skill.getAffectedPositions(state, enemy, [], null)).toEqual([{ x: 6, y: 5 }]);
  });

  it('preview без hovered цели пустой, с целью — совпадает с resolve', () => {
    const skill = createSelfBuffSkill({ id: 'bulwark', statusType: 'bulwark', duration: 1 });
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    expect(skill.preview(state, player, [], null)).toEqual([]);
    expect(skill.preview(state, player, [], { x: 5, y: 5 })).toEqual(
      skill.resolve(state, player, [{ x: 5, y: 5 }]),
    );
  });
});

describe('getSkillExecutor: разрешение kind selfBuff', () => {
  beforeEach(() => {
    initMockRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('возвращает generic-исполнитель для шаблона с kind selfBuff без регистрации', () => {
    const executor = getSkillExecutor('bulwark');

    expect(executor).toBeDefined();
    expect(executor!.id).toBe('bulwark');

    const state = makeGameState();
    const enemy = makeEnemy({ x: 6, y: 5 });
    const intents = executor!.resolve(state, enemy, [{ x: 6, y: 5 }]);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      status: { type: 'bulwark', duration: 1 },
    });
  });

  it('кэширует собранный исполнитель (тот же экземпляр при повторном запросе)', () => {
    expect(getSkillExecutor('bulwark')).toBe(getSkillExecutor('bulwark'));
  });

  it('возвращает undefined для неизвестной способности', () => {
    expect(getSkillExecutor('unknown_ability')).toBeUndefined();
  });
});

describe('selfBuff cast integration', () => {
  beforeEach(() => {
    initMockRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('каст накладывает статус из параметров kind selfBuff и выставляет кулдаун шаблона', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 3,
      maxAp: 3,
      abilities: [{ templateId: 'bulwark', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const sim = createTestSimulation(state);
    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'bulwark',
      targets: [{ x: 5, y: 5 }],
    });

    expect(result.success).toBe(true);
    expect(player.statusEffects.some((s) => s.type === 'bulwark' && s.duration === 1)).toBe(true);
    expect(player.abilities.find((a) => a.templateId === 'bulwark')?.currentCooldown).toBe(4);
    expect(player.ap).toBe(2);
  });
});
