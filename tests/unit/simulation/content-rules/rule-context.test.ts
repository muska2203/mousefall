/**
 * Тесты построителя контекста правил `buildRuleContext`.
 */

import { describe, it, expect } from 'vitest';
import { buildRuleContext, type RuleContext } from '../../../../src/simulation/content-rules/rule-context';
import {
  makePlayer,
  makeEnemy,
  makeStateWithPlayerAndEntity,
} from '../../../fixtures/gameState';
import type { GameEvent, Intent, StatusEffect } from '../../../../src/simulation/core-types';

type PartialContext = Partial<RuleContext>;

function expectContext(
  actual: RuleContext,
  expected: PartialContext,
) {
  if ('event' in expected) expect(actual.event).toBe(expected.event);
  if ('sourceEntityId' in expected) expect(actual.sourceEntityId).toBe(expected.sourceEntityId);
  if ('targetEntityId' in expected) expect(actual.targetEntityId).toBe(expected.targetEntityId);
  if ('collisionTargetId' in expected) expect(actual.collisionTargetId).toBe(expected.collisionTargetId);
  if ('abilityTargetPosition' in expected) expect(actual.abilityTargetPosition).toEqual(expected.abilityTargetPosition);
  if ('abilityTargets' in expected) expect(actual.abilityTargets).toEqual(expected.abilityTargets);
  if ('eventPosition' in expected) expect(actual.eventPosition).toEqual(expected.eventPosition);
  if ('eventTags' in expected) expect(actual.eventTags).toEqual(expected.eventTags);
  if ('eventDamage' in expected) expect(actual.eventDamage).toBe(expected.eventDamage);
  if ('eventAmount' in expected) expect(actual.eventAmount).toBe(expected.eventAmount);
  if ('eventDuration' in expected) expect(actual.eventDuration).toBe(expected.eventDuration);
  if ('eventStacks' in expected) expect(actual.eventStacks).toBe(expected.eventStacks);
}

describe('buildRuleContext', () => {
  const player = makePlayer({ x: 5, y: 5 });
  const enemy = makeEnemy({ id: 'enemy_test_1', x: 6, y: 5 });
  const state = makeStateWithPlayerAndEntity(player, enemy);

  describe('события', () => {
    it('ENTITY_DAMAGED: заполняет source, target, position, damage и теги', () => {
      const event: GameEvent = {
        type: 'ENTITY_DAMAGED',
        targetId: enemy.id,
        sourceEntityId: player.id,
        damage: 12,
        position: { x: 6, y: 5 },
        tags: ['damage.physical.slashing'],
      };

      expectContext(buildRuleContext(state, event), {
        sourceEntityId: player.id,
        targetEntityId: enemy.id,
        eventPosition: { x: 6, y: 5 },
        eventTags: ['damage.physical.slashing'],
        eventDamage: 12,
        eventAmount: null,
        eventDuration: null,
        eventStacks: null,
        collisionTargetId: null,
        abilityTargetPosition: null,
        abilityTargets: null,
      });
    });

    it('ENTITY_HEALED: заполняет target, position, amount; source равен null', () => {
      const event: GameEvent = {
        type: 'ENTITY_HEALED',
        entityId: player.id,
        amount: 8,
        newHp: 80,
        position: { x: 5, y: 5 },
      };

      expectContext(buildRuleContext(state, event), {
        sourceEntityId: null,
        targetEntityId: player.id,
        eventPosition: { x: 5, y: 5 },
        eventAmount: 8,
        eventTags: [],
      });
    });

    it('ENTITY_COLLIDED: заполняет source, target, collisionTargetId и position', () => {
      const event: GameEvent = {
        type: 'ENTITY_COLLIDED',
        entityId: player.id,
        targetId: enemy.id,
        collisionType: 'actor',
        sourceEntityId: null,
        position: { x: 6, y: 5 },
        dx: 1,
        dy: 0,
        tags: ['displacement.push', 'collision.actor'],
      };

      expectContext(buildRuleContext(state, event), {
        sourceEntityId: null,
        targetEntityId: player.id,
        collisionTargetId: enemy.id,
        eventPosition: { x: 6, y: 5 },
      });
    });

    it('STATUS_APPLIED: заполняет target, duration и позицию сущности', () => {
      const status: StatusEffect = {
        type: 'poisoned',
        duration: 3,
        value: 2,
        statModifiers: null,
      };
      const event: GameEvent = {
        type: 'STATUS_APPLIED',
        entityId: enemy.id,
        effect: status,
      };

      expectContext(buildRuleContext(state, event), {
        sourceEntityId: null,
        targetEntityId: enemy.id,
        eventPosition: { x: 6, y: 5 },
        eventDuration: 3,
        eventTags: [],
      });
    });

    it('ABILITY_USED: заполняет source, target, abilityTargetPosition, abilityTargets и eventPosition', () => {
      const event: GameEvent = {
        type: 'ABILITY_USED',
        entityId: player.id,
        abilityId: 'fireball',
        targets: [{ x: 6, y: 5 }],
        from: { x: 5, y: 5 },
      };

      expectContext(buildRuleContext(state, event), {
        sourceEntityId: player.id,
        targetEntityId: enemy.id,
        abilityTargetPosition: { x: 6, y: 5 },
        abilityTargets: [enemy.id],
        eventPosition: { x: 6, y: 5 },
      });
    });

    it('ABILITY_USED с несколькими целями собирает все ID сущностей в точках targets', () => {
      const secondEnemy = makeEnemy({ id: 'enemy_test_2', x: 7, y: 5 });
      const stateWithTwoEnemies = makeStateWithPlayerAndEntity(player, enemy);
      stateWithTwoEnemies.entities.set(secondEnemy.id, secondEnemy);

      const event: GameEvent = {
        type: 'ABILITY_USED',
        entityId: player.id,
        abilityId: 'aoe',
        targets: [{ x: 6, y: 5 }, { x: 7, y: 5 }],
        from: { x: 5, y: 5 },
      };

      expectContext(buildRuleContext(stateWithTwoEnemies, event), {
        sourceEntityId: player.id,
        targetEntityId: enemy.id,
        abilityTargetPosition: { x: 6, y: 5 },
        abilityTargets: [enemy.id, secondEnemy.id],
        eventPosition: { x: 6, y: 5 },
      });
    });

    it('TURN_BEGAN: заполняет source из actorId и позицию актора', () => {
      const event: GameEvent = {
        type: 'TURN_BEGAN',
        side: 'player',
        round: 1,
        actorId: player.id,
      };

      expectContext(buildRuleContext(state, event), {
        sourceEntityId: player.id,
        targetEntityId: null,
        eventPosition: { x: 5, y: 5 },
      });
    });

    it('AP_RESTORED: заполняет source, amount и позицию сущности', () => {
      const event: GameEvent = {
        type: 'AP_RESTORED',
        entityId: enemy.id,
        amount: 2,
        remaining: 3,
      };

      expectContext(buildRuleContext(state, event), {
        sourceEntityId: enemy.id,
        targetEntityId: null,
        eventPosition: { x: 6, y: 5 },
        eventAmount: 2,
      });
    });
  });

  describe('интенты', () => {
    it('DAMAGE: заполняет source, target, damage и позицию цели', () => {
      const intent: Intent = {
        type: 'DAMAGE',
        entityId: enemy.id,
        sourceEntityId: player.id,
        damage: 15,
        tags: ['damage.physical.piercing'],
      };

      expectContext(buildRuleContext(state, intent), {
        sourceEntityId: player.id,
        targetEntityId: enemy.id,
        eventPosition: { x: 6, y: 5 },
        eventDamage: 15,
        eventTags: ['damage.physical.piercing'],
      });
    });

    it('PUSH: заполняет source, target и позицию цели', () => {
      const intent: Intent = {
        type: 'PUSH',
        entityId: enemy.id,
        dx: 1,
        dy: 0,
        sourceEntityId: player.id,
      };

      expectContext(buildRuleContext(state, intent), {
        sourceEntityId: player.id,
        targetEntityId: enemy.id,
        eventPosition: { x: 6, y: 5 },
        eventTags: [],
      });
    });

    it('APPLY_STATUS: заполняет target и позицию цели', () => {
      const status: StatusEffect = {
        type: 'burning',
        duration: 2,
        value: 3,
        statModifiers: null,
      };
      const intent: Intent = {
        type: 'APPLY_STATUS',
        entityId: enemy.id,
        status,
      };

      expectContext(buildRuleContext(state, intent), {
        sourceEntityId: null,
        targetEntityId: enemy.id,
        eventPosition: { x: 6, y: 5 },
      });
    });

    it('MOVE: заполняет target и позицию сущности', () => {
      const intent: Intent = {
        type: 'MOVE',
        entityId: player.id,
        dx: 1,
        dy: 0,
      };

      expectContext(buildRuleContext(state, intent), {
        sourceEntityId: null,
        targetEntityId: player.id,
        eventPosition: { x: 5, y: 5 },
      });
    });

    it('HEAL: заполняет target, amount и позицию цели', () => {
      const intent: Intent = {
        type: 'HEAL',
        entityId: player.id,
        amount: 10,
      };

      expectContext(buildRuleContext(state, intent), {
        sourceEntityId: null,
        targetEntityId: player.id,
        eventPosition: { x: 5, y: 5 },
        eventAmount: 10,
      });
    });
  });

  describe('fallback eventPosition', () => {
    it('AP_RESTORED без собственной позиции использует позицию sourceEntityId', () => {
      const event: GameEvent = {
        type: 'AP_RESTORED',
        entityId: player.id,
        amount: 1,
        remaining: 2,
      };

      expectContext(buildRuleContext(state, event), {
        eventPosition: { x: 5, y: 5 },
      });
    });

    it('использует позицию targetEntityId, если собственная позиция не задана', () => {
      const intent: Intent = {
        type: 'APPLY_STATUS',
        entityId: enemy.id,
        status: {
          type: 'poisoned',
          duration: 1,
          value: 1,
          statModifiers: null,
        },
      };

      expectContext(buildRuleContext(state, intent), {
        eventPosition: { x: 6, y: 5 },
      });
    });

    it('использует позицию collisionTargetId, если других позиций нет', () => {
      const event: GameEvent = {
        type: 'ENTITY_COLLIDED',
        entityId: 'unknown_actor',
        targetId: enemy.id,
        collisionType: 'actor',
        sourceEntityId: null,
        position: { x: 6, y: 5 },
        dx: 0,
        dy: 0,
        tags: ['displacement.push', 'collision.actor'],
      };

      // Собственная position задана, поэтому fallback не применяется.
      // Проверим fallback, если position отсутствует.
      const eventNoPosition = { ...event, position: undefined as unknown as { x: number; y: number } };
      expectContext(buildRuleContext(state, eventNoPosition), {
        eventPosition: { x: 6, y: 5 },
      });
    });
  });

  describe('eventTags', () => {
    it('по умолчанию равны пустому массиву, если tags не указаны', () => {
      const event: GameEvent = {
        type: 'ENTITY_HEALED',
        entityId: player.id,
        amount: 5,
        newHp: 85,
        position: { x: 5, y: 5 },
      };

      const ctx = buildRuleContext(state, event);
      expect(ctx.eventTags).toEqual([]);
    });

    it('берётся из поля tags интента', () => {
      const intent: Intent = {
        type: 'DAMAGE',
        entityId: enemy.id,
        sourceEntityId: player.id,
        damage: 5,
        tags: ['tag.a', 'tag.b'],
      };

      expectContext(buildRuleContext(state, intent), {
        eventTags: ['tag.a', 'tag.b'],
      });
    });
  });
});
