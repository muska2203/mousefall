import { describe, expect, it, vi } from 'vitest';
import { makeGameState, makePlayer, makeTestMap } from '../../../fixtures/gameState';
import { oilFlaskSkill } from '../../../../src/simulation/skills/executors/oilFlaskSkill';

describe('oilFlaskSkill', () => {
  it('порождает SPAWN_TILE_EFFECT с маслом на тайле пола', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = oilFlaskSkill.resolve(state, player, [{ x: 6, y: 5 }]);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'SPAWN_TILE_EFFECT',
      effectType: 'oil',
      position: { x: 6, y: 5 },
    });
  });

  it('не порождает интентов на стене', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = oilFlaskSkill.resolve(state, player, [{ x: 0, y: 0 }]);

    expect(intents).toHaveLength(0);
  });

  it('возвращает пустой массив при отсутствии цели', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const intents = oilFlaskSkill.resolve(state, player, []);

    expect(intents).toHaveLength(0);
  });

  it('getAffectedPositions возвращает только hovered target', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const hoveredTarget = { x: 6, y: 5 };

    const positions = oilFlaskSkill.getAffectedPositions(state, player, [], hoveredTarget);

    expect(positions).toEqual([hoveredTarget]);
  });

  it('getAffectedPositions возвращает пустой массив без hovered target', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const positions = oilFlaskSkill.getAffectedPositions(state, player, [], null);

    expect(positions).toHaveLength(0);
  });

  it('preview вызывает resolve для hovered target', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const resolveSpy = vi.spyOn(oilFlaskSkill, 'resolve');
    const hoveredTarget = { x: 6, y: 5 };

    const previewIntents = oilFlaskSkill.preview(state, player, [], hoveredTarget);

    expect(resolveSpy).toHaveBeenCalledWith(state, player, [hoveredTarget]);
    expect(previewIntents).toEqual(
      oilFlaskSkill.resolve(state, player, [hoveredTarget]),
    );

    resolveSpy.mockRestore();
  });

  it('preview возвращает пустой массив без hovered target', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const intents = oilFlaskSkill.preview(state, player, [], null);

    expect(intents).toHaveLength(0);
  });
});
