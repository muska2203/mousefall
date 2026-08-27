/**
 * Интеграционные тесты скрипта `scripts/validate-content.ts`
 * и валидации ссылок на контентные правила.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

import { buildContent } from '../../src/content/templates';
import { validateContentRuleReferences } from '../../src/simulation/content-rules/validation';
import { validateContentReferences, validateModifierTextPlaceholders } from '../../src/content/validate-references';
import {
  DoorTemplateSchema,
  EntityTemplateSchema,
  MapParamsSchema,
} from '../../src/content/schemas';
import type {
  AbilityTemplate,
  DoorTemplate,
  EntityTemplate,
  ItemTemplate,
  LoadedContent,
  MapParams,
  ModifierTemplate,
  PlayerTemplate,
  RoomTypeTemplate,
  StatusTemplate,
} from '../../src/content/schemas';
import type { ContentTexts } from '../../src/content/texts/types';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_SCRIPT_COMMAND = 'npm run validate:content';

function runValidate(): { status: number; output: string } {
  try {
    const output = execSync(DEFAULT_SCRIPT_COMMAND, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { status: 0, output };
  } catch (err) {
    const error = err as { status: number; stdout?: string; stderr?: string };
    const stdout = typeof error.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr : '';
    return {
      status: error.status,
      output: stdout + stderr,
    };
  }
}

describe('validate-content script', () => {
  it('проходит на текущем контенте с кодом 0', () => {
    const { status, output } = runValidate();
    expect(status).toBe(0);
    expect(output).toContain('OK: весь контент валиден');
  });

  it('валидация ссылок падает, если у шаблона несуществующий ruleId', () => {
    const content = buildContent();
    const counterattack = content.statuses.get('counterattack');
    expect(counterattack).toBeDefined();

    // Клонируем шаблон с битым ruleId и проверяем, что валидация его находит.
    content.statuses.set('counterattack', {
      ...counterattack!,
      ruleIds: [...counterattack!.ruleIds, 'nonexistent_rule_for_validation_test'],
    });

    expect(() => validateContentRuleReferences(content)).toThrow(/nonexistent_rule_for_validation_test/);
  });

  it('валидация ссылок между шаблонами находит несуществующий templateId в lootTable', () => {
    const content = buildContent();
    const catSmall = content.entities.get('cat_small');
    expect(catSmall).toBeDefined();

    // Клонируем шаблон с битой ссылкой на предмет и проверяем, что валидация её находит.
    content.entities.set('cat_small', {
      ...catSmall!,
      lootTable: [...catSmall!.lootTable, { templateId: 'nonexistent_item_for_validation_test', weight: 1 }],
    });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'entities.cat_small' &&
      e.field === 'lootTable[].templateId' &&
      e.problem.includes('nonexistent_item_for_validation_test'),
    )).toBe(true);
  });

  it('находит плейсхолдер {value} в описании аффикса со scaling none', () => {
    const content = buildContent();
    // mod_poison_on_hit — rule-аффикс со scaling 'none' (ролленного значения нет).
    expect(content.modifiers?.get('mod_poison_on_hit')?.scaling.kind).toBe('none');

    const texts = {
      modifiers: {
        mod_poison_on_hit: { name: 'Тест', description: 'Отравление на {value} ходов' },
      },
    } as unknown as ContentTexts;

    const errors = validateModifierTextPlaceholders(content, { ru: texts, en: texts });
    expect(errors.some((e) =>
      e.path === 'modifiers.mod_poison_on_hit' &&
      e.field === 'description' &&
      e.problem.includes('{value}'),
    )).toBe(true);
  });

  it('пропускает плейсхолдер {value} в описании аффикса со scaling perLevel', () => {
    const content = buildContent();
    // mod_sturdy_armor — stat-аффикс со scaling 'perLevel' (значение роллится).
    expect(content.modifiers?.get('mod_sturdy_armor')?.scaling.kind).toBe('perLevel');

    const texts = {
      modifiers: {
        mod_sturdy_armor: { name: 'Тест', description: '+{value} к броне' },
      },
    } as unknown as ContentTexts;

    expect(validateModifierTextPlaceholders(content, { ru: texts, en: texts })).toEqual([]);
  });

  it('пропускает плейсхолдер {value} в описании аффикса со scaling fixed', () => {
    const content = buildContent();
    // mod_guardian_vitality — stat-аффикс со scaling 'fixed' (детерминированное значение).
    expect(content.modifiers?.get('mod_guardian_vitality')?.scaling.kind).toBe('fixed');

    const texts = {
      modifiers: {
        mod_guardian_vitality: { name: 'Тест', description: 'Максимум здоровья: +{value}.' },
      },
    } as unknown as ContentTexts;

    expect(validateModifierTextPlaceholders(content, { ru: texts, en: texts })).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Фирменные модификаторы предметов (fixedModifiers)
// ─────────────────────────────────────────────

/** Минимальный синтетический контент для проверок fixedModifiers. */
function makeSyntheticContent(overrides: Partial<LoadedContent>): LoadedContent {
  return {
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    maps: new Map(),
    stairs: new Map(),
    doors: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
    ...overrides,
  } as LoadedContent;
}

function mockModifier(overrides: Partial<ModifierTemplate> = {}): ModifierTemplate {
  return {
    id: 'mod_test',
    effect: { kind: 'stat', stat: 'maxHp', op: 'add' },
    scaling: { kind: 'fixed', value: 10 },
    applicableSubtypes: ['sword'],
    polarity: 'positive',
    poolEligible: false,
    weight: 1,
    ...overrides,
  } as ModifierTemplate;
}

function mockWeapon(overrides: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    id: 'test_sword',
    type: 'weapon',
    subtype: 'sword',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    fixedModifiers: [],
    grantedAbilities: [],
    apCost: 1,
    ...overrides,
  } as ItemTemplate;
}

describe('validateContentReferences: fixedModifiers', () => {
  it('находит ссылку на несуществующий модификатор в fixedModifiers', () => {
    const content = makeSyntheticContent({
      items: new Map([['test_sword', mockWeapon({ fixedModifiers: ['nonexistent_mod'] })]]),
      modifiers: new Map(),
    });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'items.test_sword' &&
      e.field === 'fixedModifiers' &&
      e.problem.includes('nonexistent_mod'),
    )).toBe(true);
  });

  it('находит фирменный модификатор, неприменимый к подтипу предмета', () => {
    const content = makeSyntheticContent({
      items: new Map([['test_sword', mockWeapon({ fixedModifiers: ['mod_test'] })]]),
      modifiers: new Map([['mod_test', mockModifier({ applicableSubtypes: ['light'] })]]),
    });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'items.test_sword' &&
      e.field === 'fixedModifiers' &&
      e.problem.includes('mod_test'),
    )).toBe(true);
  });

  it('находит фирменный модификатор со scaling perLevel', () => {
    const content = makeSyntheticContent({
      items: new Map([['test_sword', mockWeapon({ fixedModifiers: ['mod_test'] })]]),
      modifiers: new Map([['mod_test', mockModifier({
        scaling: { kind: 'perLevel', ranges: [{ min: 1, max: 2 }] },
      })]]),
    });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'items.test_sword' &&
      e.field === 'fixedModifiers' &&
      e.problem.includes('perLevel'),
    )).toBe(true);
  });

  it('пропускает корректный фирменный модификатор', () => {
    const content = makeSyntheticContent({
      items: new Map([['test_sword', mockWeapon({ fixedModifiers: ['mod_test'] })]]),
      modifiers: new Map([['mod_test', mockModifier()]]),
    });

    expect(validateContentReferences(content)).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Self-buff способности: ссылка statusType на шаблон статуса
// ─────────────────────────────────────────────

function mockSelfBuffAbility(statusType: string): AbilityTemplate {
  return {
    id: 'test_buff',
    kind: 'selfBuff',
    statusType,
    duration: 1,
    cooldown: 0,
    apCost: 1,
    aiPreparable: false,
    requiredWeaponTags: [],
    tags: [],
    ruleIds: [],
  };
}

function mockStatusTemplate(id: string): StatusTemplate {
  return {
    id,
    ruleIds: [],
    statusCategory: 'physical',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    statModifiers: [],
  };
}

describe('validateContentReferences: selfBuff.statusType', () => {
  it('находит statusType self-buff способности, ссылающийся на несуществующий статус', () => {
    const content = makeSyntheticContent({
      abilities: new Map([['test_buff', mockSelfBuffAbility('nonexistent_status')]]),
      statuses: new Map(),
    });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'abilities.test_buff' &&
      e.field === 'statusType' &&
      e.problem.includes('nonexistent_status'),
    )).toBe(true);
  });

  it('пропускает корректную ссылку statusType', () => {
    const content = makeSyntheticContent({
      abilities: new Map([['test_buff', mockSelfBuffAbility('test_status')]]),
      statuses: new Map([['test_status', mockStatusTemplate('test_status')]]),
    });

    expect(validateContentReferences(content)).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Шаблон игрока: ссылки starterRelicPool на реликвии
// ─────────────────────────────────────────────

function mockPlayerTemplate(starterRelicPool: string[]): PlayerTemplate {
  return {
    id: 'test_hero',
    portraitImg: '',
    maxAp: 2,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    isDefault: false,
    innateAbilities: [],
    starterRelicPool,
  } as PlayerTemplate;
}

describe('validateContentReferences: players.starterRelicPool', () => {
  it('находит ссылку на несуществующую реликвию в starterRelicPool', () => {
    const content = makeSyntheticContent({
      players: new Map([['test_hero', mockPlayerTemplate(['nonexistent_relic'])]]),
      relics: new Map(),
    });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'players.test_hero' &&
      e.field === 'starterRelicPool' &&
      e.problem.includes('nonexistent_relic'),
    )).toBe(true);
  });

  it('пропускает корректный starterRelicPool', () => {
    const content = makeSyntheticContent({
      players: new Map([['test_hero', mockPlayerTemplate(['relic_a'])]]),
      relics: new Map([['relic_a', { id: 'relic_a', grantedAbilities: [] } as never]]),
    });

    expect(validateContentReferences(content)).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Босс-инфраструктура: дефолты схем (roadMap 1.3)
// ─────────────────────────────────────────────

describe('Схемы босс-инфраструктуры: дефолты', () => {
  it('EntityTemplateSchema: isBoss по умолчанию false', () => {
    const parsed = EntityTemplateSchema.parse({ id: 'test_entity', health: { max: 1 } });
    expect(parsed.isBoss).toBe(false);
  });

  it('DoorTemplateSchema: indestructible по умолчанию false', () => {
    const parsed = DoorTemplateSchema.parse({ id: 'test_door', interactionKind: 'door', maxHp: 3 });
    expect(parsed.indestructible).toBe(false);
  });

  it('MapParamsSchema: дефолты bossRoomTypeId/bossDoorId/rewardRoomTypeId/finalFloor, bossPool не задан', () => {
    const parsed = MapParamsSchema.parse({
      id: 'test_map',
      width: 20,
      height: 20,
      minRooms: 2,
      maxRooms: 4,
      roomTypePool: ['normal'],
      startRoomTypeId: 'start',
    });
    expect(parsed.bossRoomTypeId).toBe('boss');
    expect(parsed.bossDoorId).toBe('boss_door');
    expect(parsed.rewardRoomTypeId).toBe('reward');
    expect(parsed.finalFloor).toBe(10);
    expect(parsed.bossPool).toBeUndefined();
  });

  it('MapParamsSchema: bossPool не может быть пустым массивом', () => {
    expect(() => MapParamsSchema.parse({
      id: 'test_map',
      width: 20,
      height: 20,
      minRooms: 2,
      maxRooms: 4,
      roomTypePool: ['normal'],
      startRoomTypeId: 'start',
      bossPool: [],
    })).toThrow();
  });
});

// ─────────────────────────────────────────────
// Босс-инфраструктура: валидация bossPool и типов комнат
// ─────────────────────────────────────────────

function mockMapParams(overrides: Partial<MapParams> = {}): MapParams {
  return {
    id: 'test_map',
    strategy: 'tree',
    width: 20,
    height: 20,
    minRooms: 2,
    maxRooms: 4,
    roomTypePool: ['normal'],
    startRoomTypeId: 'start',
    bossRoomTypeId: 'boss',
    bossDoorId: 'boss_door',
    rewardRoomTypeId: 'reward',
    ...overrides,
  } as MapParams;
}

function mockEntity(id: string, isBoss: boolean): EntityTemplate {
  return {
    id,
    isBoss,
    aiSightRadius: 6,
    health: { max: 10 },
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    equipment: {},
    abilities: [],
    lootTable: [],
    lootDropTable: [],
    maxAp: 1,
  } as EntityTemplate;
}

function mockRoomType(id: string): RoomTypeTemplate {
  return {
    id,
    kind: 'generated',
    weight: 0,
    minDepth: 0,
    minSize: 4,
    maxSize: 6,
    fill: {
      enemyPool: [],
      enemyDensity: 0,
      itemPool: [],
      itemDensity: 0,
      propPool: [],
      propDensity: 0,
      trapPool: [],
      trapDensity: 0,
      tileEffectPool: [],
      tileEffectDensity: 0,
      guaranteedPois: [],
    },
  } as RoomTypeTemplate;
}

/** Контент с картой bossPool и всеми существующими ссылками. */
function makeBossContent(mapOverrides: Partial<MapParams> = {}): LoadedContent {
  return makeSyntheticContent({
    maps: new Map([['test_map', mockMapParams({ bossPool: ['test_boss'], ...mapOverrides })]]),
    entities: new Map([['test_boss', mockEntity('test_boss', true)]]),
    roomTypes: new Map([
      ['normal', mockRoomType('normal')],
      ['start', mockRoomType('start')],
      ['boss', mockRoomType('boss')],
      ['reward', mockRoomType('reward')],
    ]),
    doors: new Map([['boss_door', mockDoor('boss_door')]]),
  });
}

function mockDoor(id: string): DoorTemplate {
  return {
    id,
    interactionKind: 'door',
    maxHp: 3,
    armor: 0,
    indestructible: false,
    tags: [],
    canHaveStatus: [],
  } as DoorTemplate;
}

describe('validateContentReferences: bossPool', () => {
  it('находит ссылку bossPool на несуществующий шаблон сущности', () => {
    const content = makeBossContent({ bossPool: ['nonexistent_boss'] });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'maps.test_map' &&
      e.field === 'bossPool' &&
      e.problem.includes('nonexistent_boss'),
    )).toBe(true);
  });

  it('находит шаблон из bossPool без isBoss: true', () => {
    const content = makeBossContent();
    content.entities.set('test_boss', mockEntity('test_boss', false));

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'maps.test_map' &&
      e.field === 'bossPool' &&
      e.problem.includes('isBoss'),
    )).toBe(true);
  });

  it('находит bossRoomTypeId, ссылающийся на несуществующий тип комнаты', () => {
    const content = makeBossContent({ bossRoomTypeId: 'nonexistent_room_type' });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'maps.test_map' &&
      e.field === 'bossRoomTypeId' &&
      e.problem.includes('nonexistent_room_type'),
    )).toBe(true);
  });

  it('находит rewardRoomTypeId, ссылающийся на несуществующий тип комнаты', () => {
    const content = makeBossContent({ rewardRoomTypeId: 'nonexistent_room_type' });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'maps.test_map' &&
      e.field === 'rewardRoomTypeId' &&
      e.problem.includes('nonexistent_room_type'),
    )).toBe(true);
  });

  it('находит bossDoorId, ссылающийся на несуществующий шаблон двери', () => {
    const content = makeBossContent({ bossDoorId: 'nonexistent_door' });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'maps.test_map' &&
      e.field === 'bossDoorId' &&
      e.problem.includes('nonexistent_door'),
    )).toBe(true);
  });

  it('пропускает валидную конфигурацию bossPool', () => {
    expect(validateContentReferences(makeBossContent())).toEqual([]);
  });

  it('не проверяет босс-ссылки карты без bossPool', () => {
    const content = makeSyntheticContent({
      maps: new Map([['test_map', mockMapParams({ bossRoomTypeId: 'nonexistent_room_type' })]]),
      roomTypes: new Map([
        ['normal', mockRoomType('normal')],
        ['start', mockRoomType('start')],
      ]),
    });

    expect(validateContentReferences(content)).toEqual([]);
  });
});
