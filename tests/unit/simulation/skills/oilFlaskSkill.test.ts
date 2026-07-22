import { describe, expect, it, vi } from 'vitest';
import { makeGameState, makePlayer, makeTestMap } from '../../../fixtures/gameState';
import { oilFlaskSkill } from '../../../../src/simulation/skills/executors/oilFlaskSkill';
import type { SpawnTileEffectIntent } from '../../../../src/simulation/systems/intents/types';

const TARGET_CENTER = { x: 6, y: 5 };

const EXPECTED_FLOOR_POSITIONS_AROUND_TARGET_CENTER = [
  { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 },
  { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
  { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 },
];

describe('oilFlaskSkill', () => {
  it('порождает SPAWN_TILE_EFFECT с маслом на всех клетках пола в радиусе', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = oilFlaskSkill.resolve(state, player, [TARGET_CENTER]);

    expect(intents).toHaveLength(EXPECTED_FLOOR_POSITIONS_AROUND_TARGET_CENTER.length);
    for (const pos of EXPECTED_FLOOR_POSITIONS_AROUND_TARGET_CENTER) {
      expect(intents).toContainEqual(expect.objectContaining({
        type: 'SPAWN_TILE_EFFECT',
        effectType: 'oil',
        position: pos,
      }));
    }
  });

  it('не спавнит эффект на стенах, но спавнит на полу в радиусе', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = oilFlaskSkill.resolve(state, player, [{ x: 0, y: 0 }]);

    const spawnIntents = intents.filter((i): i is SpawnTileEffectIntent => i.type === 'SPAWN_TILE_EFFECT');
    expect(spawnIntents.every(i => state.map.tiles[i.position.y]?.[i.position.x] === 'floor')).toBe(true);
    expect(spawnIntents).toContainEqual(expect.objectContaining({
      type: 'SPAWN_TILE_EFFECT',
      effectType: 'oil',
      position: { x: 1, y: 1 },
    }));
  });

  it('возвращает пустой массив при отсутствии цели', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const intents = oilFlaskSkill.resolve(state, player, []);

    expect(intents).toHaveLength(0);
  });

  it('getAffectedPositions возвращает все клетки пола в радиусе от hovered target', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });

    const positions = oilFlaskSkill.getAffectedPositions(state, player, [], TARGET_CENTER);

    expect(positions).toHaveLength(EXPECTED_FLOOR_POSITIONS_AROUND_TARGET_CENTER.length);
    for (const pos of EXPECTED_FLOOR_POSITIONS_AROUND_TARGET_CENTER) {
      expect(positions).toContainEqual(pos);
    }
  });

  it('getAffectedPositions возвращает пустой массив без hovered target', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });

    const positions = oilFlaskSkill.getAffectedPositions(state, player, [], null);

    expect(positions).toHaveLength(0);
  });

  it('getAffectedPositions не включает стены в радиусе', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });

    const positions = oilFlaskSkill.getAffectedPositions(state, player, [], { x: 0, y: 0 });

    expect(positions).toEqual([{ x: 1, y: 1 }]);
  });

  it('preview вызывает resolve для hovered target', () => {
    const state = makeGameState({ map: makeTestMap() });
    const player = makePlayer({ x: 5, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);

    const resolveSpy = vi.spyOn(oilFlaskSkill, 'resolve');

    const previewIntents = oilFlaskSkill.preview(state, player, [], TARGET_CENTER);

    expect(resolveSpy).toHaveBeenCalledWith(state, player, [TARGET_CENTER]);
    expect(previewIntents).toEqual(
      oilFlaskSkill.resolve(state, player, [TARGET_CENTER]),
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
