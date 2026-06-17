/**
 * Unit tests for GameSession presentation logic.
 */

import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { GameSession } from '../../../src/presentation/gameSession';
import { makeGameState, makePlayer, makeEnemy } from '../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../src/content/registry';
import type { Entity, EntityId } from '../../../src/simulation/types';

describe('GameSession AP display during animations', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('shows intermediate AP (0) during animations and restores AP after they complete', () => {
    // Игрок с 1 AP, враг рядом. MOVE на пустую клетку потратит последний AP,
    // запустит ход окружения и восстановит AP до maxAp.
    const player = makePlayer({ x: 5, y: 5, ap: 1, maxAp: 1 });
    const enemy = makeEnemy({ x: 6, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const session = new GameSession();
    session.loadGame(state);

    expect(session.getViewModel().renderInput?.playerStats.ap).toBe(1);

    session.dispatch({ type: 'MOVE', entityId: player.id, dx: 0, dy: 1 });

    const vmDuringAnimation = session.getViewModel();
    expect(vmDuringAnimation.renderInput?.phase).toBe('animating');
    // Пока идут анимации, должно отображаться AP после действия игрока (0),
    // а не финальное восстановленное значение.
    expect(vmDuringAnimation.renderInput?.playerStats.ap).toBe(0);

    session.onAnimationsComplete();

    const vmAfterAnimation = session.getViewModel();
    expect(vmAfterAnimation.renderInput?.phase).toBe('idle');
    expect(vmAfterAnimation.renderInput?.playerStats.ap).toBe(1);
  });

  it('shows reduced AP immediately when action does not end the turn', () => {
    // Игрок с 2 AP. MOVE потратит 1 AP, ход не закончится.
    const player = makePlayer({ x: 5, y: 5, ap: 2, maxAp: 2 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[player.id, player]]),
    });

    const session = new GameSession();
    session.loadGame(state);

    session.dispatch({ type: 'MOVE', entityId: player.id, dx: 0, dy: 1 });

    const vm = session.getViewModel();
    // Анимация может быть очень короткой, но renderInput должен показать 1 AP.
    expect(vm.renderInput?.playerStats.ap).toBe(1);
  });
});
