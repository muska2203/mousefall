// @ts-nocheck
/**
 * Юнит-тесты системы сериализации.
 *
 * Критично: эти тесты проверяют, что цикл сохранение/загрузка сохраняет
 * всё состояние, включая состояние RNG (гарантия детерминизма).
 */

import { describe, it, expect } from 'vitest';
import { serialize, deserialize, SaveCorruptError } from '../../../src/simulation/serialization';
import {makeGameState, makePlayer, makeEnemy, makeStateWithEntity} from '../../fixtures/gameState';
import { createRNG } from '../../../src/utils/rng';
import {EnemyEntity} from "@simulation/types.ts";

describe('serialize / deserialize round-trip', () => {
  it('round-trips a minimal game state', () => {
    const original = makeGameState();
    const json = serialize(original);
    const restored = deserialize(json);

    expect(restored.player).toEqual(original.player);
    expect(restored.floor).toBe(original.floor);
    expect(restored.turnNumber).toBe(original.turnNumber);
    expect(restored.phase).toBe(original.phase);
  });

  it('preserves RNG state exactly', () => {
    const original = makeGameState({ rng: createRNG(99999) });
    const json = serialize(original);
    const restored = deserialize(json);

    expect(restored.rng.seed).toBe(original.rng.seed);
    expect(restored.rng.state).toBe(original.rng.state);
  });

  it('preserves enemies', () => {
    const original = makeStateWithEntity(makeEnemy({ id: 'enemy_1', x: 3, y: 4, hp: 15 }));
    const json = serialize(original);
    const restored = deserialize(json);

    expect(restored.entities).toHaveLength(1);
    expect(restored.entities.get('enemy_1')!.id).toBe('enemy_1');
    expect((restored.entities.get('enemy_1') as EnemyEntity)!.hp).toBe(15);
  });

  it('preserves player inventory', () => {
    const original = makeGameState({
      player: makePlayer({
        inventory: [{ instanceId: 'inst_1', templateId: 'health_potion', quantity: 3 }],
      }),
    });
    const json = serialize(original);
    const restored = deserialize(json);

    expect(restored.player.inventory).toHaveLength(1);
    expect(restored.player.inventory[0]!.quantity).toBe(3);
  });

  it('preserves fog of war (explored grid)', () => {
    const original = makeGameState();
    // Отметить несколько клеток как исследованные
    original.explored[5]![5] = true;
    original.explored[3]![7] = true;

    const json = serialize(original);
    const restored = deserialize(json);

    expect(restored.explored[5]![5]).toBe(true);
    expect(restored.explored[3]![7]).toBe(true);
    expect(restored.explored[1]![1]).toBe(false);
  });

  it('produces valid JSON string', () => {
    const state = makeGameState();
    const json = serialize(state);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('deserialize — error handling', () => {
  it('throws SaveCorruptError on invalid JSON', () => {
    expect(() => deserialize('not json')).toThrow(SaveCorruptError);
  });

  it('throws SaveCorruptError on missing version field', () => {
    const json = JSON.stringify({ gameState: {} });
    expect(() => deserialize(json)).toThrow(SaveCorruptError);
  });

  it('throws SaveCorruptError on schema validation failure', () => {
    const json = JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      floorNumber: 1,
      turnNumber: 1,
      gameState: { invalid: 'data' },
    });
    expect(() => deserialize(json)).toThrow(SaveCorruptError);
  });
});
