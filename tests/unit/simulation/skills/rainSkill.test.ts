import { describe, expect, it, vi } from 'vitest';
import { makeGameState, makePlayer, makeTestMap } from '../../../fixtures/gameState';
import { rainSkill } from '../../../../src/simulation/skills/executors/rainSkill';

describe('rainSkill', () => {
  it('порождает SPAWN_TILE_EFFECT с водой на тайле пола', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = rainSkill.resolve(state, player, [{ x: 6, y: 5 }]);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'SPAWN_TILE_EFFECT',
      effectType: 'water',
      position: { x: 6, y: 5 },
    });
  });

  it('не порождает интентов на стене', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = rainSkill.resolve(state, player, [{ x: 0, y: 0 }]);

    expect(intents).toHaveLength(0);
  });

  it('возвращает пустой массив при отсутствии цели', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const intents = rainSkill.resolve(state, player, []);

    expect(intents).toHaveLength(0);
  });

  it('getAffectedPositions возвращает только hovered target', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const hoveredTarget = { x: 6, y: 5 };

    const positions = rainSkill.getAffectedPositions(state, player, [], hoveredTarget);

    expect(positions).toEqual([hoveredTarget]);
  });

  it('getAffectedPositions возвращает пустой массив без hovered target', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const positions = rainSkill.getAffectedPositions(state, player, [], null);

    expect(positions).toHaveLength(0);
  });

  it('preview вызывает resolve для hovered target', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const resolveSpy = vi.spyOn(rainSkill, 'resolve');
    const hoveredTarget = { x: 6, y: 5 };

    const previewIntents = rainSkill.preview(state, player, [], hoveredTarget);

    expect(resolveSpy).toHaveBeenCalledWith(state, player, [hoveredTarget]);
    expect(previewIntents).toEqual(
      rainSkill.resolve(state, player, [hoveredTarget]),
    );

    resolveSpy.mockRestore();
  });

  it('preview возвращает пустой массив без hovered target', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const intents = rainSkill.preview(state, player, [], null);

    expect(intents).toHaveLength(0);
  });
});
