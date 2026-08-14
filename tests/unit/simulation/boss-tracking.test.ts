/**
 * Тесты bossTracking: принадлежность шаблона к боссам читается из Content Registry
 * (флаг isBoss шаблона сущности), а не из захардкоженного списка.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isBossTemplate } from '../../../src/simulation/systems/bossTracking';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import { createTestTerrains } from '../../fixtures/gameState';

describe('isBossTemplate', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map([
        ['cat_guardian', { id: 'cat_guardian', isBoss: true } as any],
        ['cat_small', { id: 'cat_small', isBoss: false } as any],
      ]),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
      statuses: new Map(),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('возвращает true для шаблона с isBoss: true', () => {
    expect(isBossTemplate('cat_guardian')).toBe(true);
  });

  it('возвращает false для обычного врага', () => {
    expect(isBossTemplate('cat_small')).toBe(false);
  });

  it('возвращает false для несуществующего шаблона', () => {
    expect(isBossTemplate('nonexistent_template')).toBe(false);
  });
});

describe('isBossTemplate без инициализированного реестра', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('возвращает false, если реестр не инициализирован', () => {
    expect(isBossTemplate('cat_guardian')).toBe(false);
  });
});
