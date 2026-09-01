/**
 * Интеграционный сценарий: расходник «Ритуальный надрез» (ritual_cut)
 * в реальном контенте (этап 5 плана docs/plans/bleed-builds-implementation.md).
 *
 * Контент реальный (loadTestContent → buildContent): предмет берётся из
 * реестра, использование идёт через dispatch(USE_ITEM) — полный путь
 * validate → resolve → execute с исполнением интентов движком.
 *
 * Проверяет:
 * - на игрока накладываются оба статуса: bleeding (3 хода) и empowered (2 хода);
 * - statModifiers шаблона empowered реально добавляют +2 к эффективному урону;
 * - предмет расходуется, таргетинг клеткой не требуется.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {resetRegistry} from '../../../src/content/registry';
import {getEffectiveWeaponDamageRange} from '../../../src/simulation/systems/stats/effective-stats';
import {makeGameState, makePlayer, makeTestMap} from '../../fixtures/gameState';
import {createTestSimulation} from '../../helpers/simulation';
import {loadTestContent} from './helpers';

describe('Ритуальный надрез — использование в бою', () => {
  beforeEach(() => {
    loadTestContent();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('dispatch(USE_ITEM): оба статуса на игроке, +2 к урону от empowered, предмет расходован', () => {
    const state = makeGameState({map: makeTestMap()});
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 2,
      maxAp: 2,
      inventory: [{instanceId: 'cut_1', templateId: 'ritual_cut', quantity: 1, grantedAbilities: [], affixes: []}],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const damageBefore = getEffectiveWeaponDamageRange(player);
    const sim = createTestSimulation(state);
    const result = sim.dispatch({type: 'USE_ITEM', entityId: player.id, itemInstanceId: 'cut_1'});

    expect(result.success).toBe(true);
    expect(player.statusEffects).toContainEqual(
      expect.objectContaining({type: 'bleeding', duration: 3}),
    );
    expect(player.statusEffects).toContainEqual(
      expect.objectContaining({type: 'empowered', duration: 2}),
    );
    expect(player.inventory).toHaveLength(0);

    // Боевой транс: +2 к обоим концам эффективного рейнжа урона.
    const damageAfter = getEffectiveWeaponDamageRange(player);
    expect(damageAfter.min).toBe(damageBefore.min + 2);
    expect(damageAfter.max).toBe(damageBefore.max + 2);
  });
});
