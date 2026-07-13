/**
 * Интеграционные тесты подключения контентных правил к боевому циклу.
 */

import { describe, it, expect, vi } from 'vitest';
import { ExecutionBuilder, ExecutionNode } from '@simulation/core-types.ts';
import { executeIntent } from '@simulation/systems/intents/execute-intent.ts';
import {
  makePlayer,
  makeEnemy,
  makeStateWithPlayerAndEntity,
} from '../../../fixtures/gameState';

function findNodeByEventType(root: ExecutionNode, eventType: string): ExecutionNode | null {
  if (root.event.type === eventType) return root;
  for (const child of root.children) {
    const found = findNodeByEventType(child, eventType);
    if (found) return found;
  }
  return null;
}

describe('executeIntent + content rules integration', () => {
  describe('при включённом флаге', () => {
    it('модификатор увеличивает DAMAGE-интент (world_global_damage_multiply ×1.1)', () => {
      const player = makePlayer({ x: 5, y: 5 });
      const enemy = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
      const state = makeStateWithPlayerAndEntity(player, enemy);
      state.featureFlags.contentRulesEnabled = true;

      const builder = new ExecutionBuilder({
        type: 'ACTION_APPLIED',
        action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
      });

      executeIntent(
        state,
        {
          type: 'DAMAGE',
          entityId: enemy.id,
          sourceEntityId: player.id,
          damage: 10,
          tags: ['damage.physical.slashing'],
        },
        builder,
        builder.root,
      );

      const damageEvent = findNodeByEventType(builder.root, 'ENTITY_DAMAGED');
      expect(damageEvent?.event).toMatchObject({ damage: 11 });
      expect(enemy.hp).toBe(89);
    });

    it('реакция на огненный урон накладывает горение (world_global_fire_bonus)', () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1);

      try {
        const player = makePlayer({ x: 5, y: 5 });
        const enemy = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
        const state = makeStateWithPlayerAndEntity(player, enemy);
        state.featureFlags.contentRulesEnabled = true;

        const builder = new ExecutionBuilder({
          type: 'ACTION_APPLIED',
          action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
        });

        executeIntent(
          state,
          {
            type: 'DAMAGE',
            entityId: enemy.id,
            sourceEntityId: player.id,
            damage: 10,
            tags: ['damage.magical.fire'],
          },
          builder,
          builder.root,
        );

        const burning = enemy.statusEffects.find((e) => e.type === 'burning');
        expect(burning).toBeDefined();
        expect(burning!.duration).toBe(1);
      } finally {
        randomSpy.mockRestore();
      }
    });
  });

  describe('при выключенном флаге', () => {
    it('новая система не срабатывает: урон не умножается, горение не накладывается', () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1);

      try {
        const player = makePlayer({ x: 5, y: 5 });
        const enemy = makeEnemy({ x: 6, y: 5, hp: 100, armor: 0 });
        const state = makeStateWithPlayerAndEntity(player, enemy);
        // featureFlags по умолчанию выключен

        const builder = new ExecutionBuilder({
          type: 'ACTION_APPLIED',
          action: { type: 'ATTACK', entityId: player.id, dx: 1, dy: 0 },
        });

        executeIntent(
          state,
          {
            type: 'DAMAGE',
            entityId: enemy.id,
            sourceEntityId: player.id,
            damage: 10,
            tags: ['damage.magical.fire'],
          },
          builder,
          builder.root,
        );

        const damageEvent = findNodeByEventType(builder.root, 'ENTITY_DAMAGED');
        expect(damageEvent?.event).toMatchObject({ damage: 10 });
        expect(enemy.hp).toBe(90);
        expect(enemy.statusEffects.some((e) => e.type === 'burning')).toBe(false);
      } finally {
        randomSpy.mockRestore();
      }
    });
  });
});
