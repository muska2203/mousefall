/**
 * Тесты сборки ViewModel коллекции реликвий (панель реликвий, roadmap 0.3).
 *
 * Проверяет группировку по шаблонам (стаки), порядок (порядок получения),
 * перенос локализации/иконок/рамки в VM, пустую коллекцию и неизвестные шаблоны.
 * Работает на реальном контенте (buildContent), т.к. локализация живёт в texts/.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import '@i18n/config';
import {GameSession} from '../../../src/presentation/gameSession';
import {makeGameState, makePlayer} from '../../fixtures/gameState';
import {initRegistry, resetRegistry} from '../../../src/content/registry';
import {buildContent} from '../../../src/content/templates';
import type {Entity, EntityId, RelicInstance} from '../../../src/simulation/types';

describe('GameSession — ViewModel коллекции реликвий', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(buildContent());
  });

  afterEach(() => {
    resetRegistry();
  });

  function createSessionWithRelics(relics: RelicInstance[]): GameSession {
    const player = makePlayer({relics});
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });
    const session = new GameSession();
    session.loadGame(state);
    return session;
  }

  it('пустая коллекция даёт пустой массив', () => {
    const session = createSessionWithRelics([]);
    expect(session.getViewModel().renderInput?.relics).toEqual([]);
  });

  it('группирует одинаковые реликвии в стак, порядок — по первому получению', () => {
    const session = createSessionWithRelics([
      {instanceId: 'relic_1', templateId: 'relic_venom_gland'},
      {instanceId: 'relic_2', templateId: 'relic_salamander_heart'},
      {instanceId: 'relic_3', templateId: 'relic_venom_gland'},
    ]);
    const relics = session.getViewModel().renderInput?.relics ?? [];
    expect(relics.map(r => r.templateId)).toEqual(['relic_venom_gland', 'relic_salamander_heart']);
    expect(relics[0]?.count).toBe(2);
    expect(relics[1]?.count).toBe(1);
  });

  it('переносит в VM локализацию, эффекты, иконку, редкость и рамку', () => {
    const session = createSessionWithRelics([
      {instanceId: 'relic_1', templateId: 'relic_salamander_heart'},
    ]);
    const relic = session.getViewModel().renderInput?.relics?.[0];
    expect(relic?.name).toBe('Уголёк из-за плиты');
    expect(relic?.effects.map(e => e.key)).toEqual([
      'relic_salamander_heart_fire_infusion',
      'relic_salamander_heart_fire_vulnerability',
    ]);
    expect(relic?.effects[0]?.name).toBe('Огненное насыщение');
    expect(relic?.effects[0]?.description).toContain('огненными');
    expect(relic?.flavorText).toContain('уголёк');
    expect(relic?.icon).toBe('/assets/relics/relic_salamander_heart.png');
    expect(relic?.fallback).toBe('🔥');
    expect(relic?.rarity).toBe('rare');
    expect(relic?.frameUrl).toBe('/assets/items/loot_frame_rare.png');
  });

  it('добавляет в effects пункт модификатора характеристики после правил', () => {
    const session = createSessionWithRelics([
      {instanceId: 'relic_1', templateId: 'relic_scavenger'},
    ]);
    const relic = session.getViewModel().renderInput?.relics?.[0];
    expect(relic?.effects.map(e => e.key)).toEqual([
      'relic_scavenger_heal_on_pickup',
      'stat_maxHp',
    ]);
    const modifier = relic?.effects[1];
    expect(modifier?.name).toBe('Макс. здоровье');
    expect(modifier?.description).toBe('−5');
  });

  it('пропускает реликвии с неизвестным шаблоном', () => {
    const session = createSessionWithRelics([
      {instanceId: 'relic_1', templateId: 'relic_unknown'},
      {instanceId: 'relic_2', templateId: 'relic_venom_gland'},
    ]);
    const relics = session.getViewModel().renderInput?.relics ?? [];
    expect(relics.map(r => r.templateId)).toEqual(['relic_venom_gland']);
  });
});
