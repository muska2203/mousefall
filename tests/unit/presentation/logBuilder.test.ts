/**
 * Unit-тесты logBuilder для observability-событий RULE_TRIGGERED.
 */

import { describe, it, expect } from 'vitest';
import { extractEvents, gameEventToLog } from '../../../src/presentation/logBuilder';
import { ExecutionBuilder } from '../../../src/simulation/core-types';
import type { GameEvent, SimulationResult, TurnSide } from '@simulation/types';
import { makeEnemy, makePlayer, makeStateWithPlayerAndEntity } from '../../fixtures/gameState';

function makeResultWithRuleTriggered(side: TurnSide = 'enemies'): SimulationResult {
  const event: GameEvent = {
    type: 'ENTITY_DAMAGED',
    targetId: 'enemy',
    sourceEntityId: 'player',
    damage: 5,
    position: { x: 1, y: 1 },
    tags: ['damage.magical.fire'],
  };
  const builder = new ExecutionBuilder(event);
  builder.addChild(builder.root, {
    type: 'RULE_TRIGGERED',
    ruleId: 'fire_damage_ignites',
    layer: 'world',
    ownerEntityId: null,
    triggerEventType: 'ENTITY_DAMAGED',
    triggerTags: ['damage.magical.fire'],
    intents: [
      {
        type: 'APPLY_STATUS',
        entityId: 'enemy',
        sourceEntityId: null,
        status: { type: 'burning', duration: 3, value: 0, statModifiers: null },
      },
    ],
    conditionMatched: true,
  });

  return {
    success: true,
    stateChanged: true,
    hasMoreSteps: false,
    phases: [{ side, actions: [builder.root] }],
  } as SimulationResult;
}

describe('logBuilder RULE_TRIGGERED', () => {
  it('extractEvents включает RULE_TRIGGERED только в debug-режиме', () => {
    const result = makeResultWithRuleTriggered();

    expect(extractEvents(result, false).some((e) => e.type === 'RULE_TRIGGERED')).toBe(false);
    expect(extractEvents(result, true).some((e) => e.type === 'RULE_TRIGGERED')).toBe(true);
  });

  it('gameEventToLog возвращает debug-строку для RULE_TRIGGERED только в debug-режиме', () => {
    const event: GameEvent = {
      type: 'RULE_TRIGGERED',
      ruleId: 'fire_damage_ignites',
      layer: 'world',
      ownerEntityId: null,
      triggerEventType: 'ENTITY_DAMAGED',
      triggerTags: ['damage.magical.fire'],
      intents: [
        {
          type: 'APPLY_STATUS',
          entityId: 'enemy',
          sourceEntityId: null,
          status: { type: 'burning', duration: 3, value: 0, statModifiers: null },
        },
      ],
      conditionMatched: true,
    };
    const state = makeStateWithPlayerAndEntity(makePlayer(), makeEnemy({ id: 'enemy' }));

    const debugEntry = gameEventToLog(state, event, 'ru', true);
    expect(debugEntry).not.toBeNull();
    expect(debugEntry!.text).toContain('fire_damage_ignites');
    expect(debugEntry!.text).toContain('world');
    expect(debugEntry!.variant).toBe('info');

    expect(gameEventToLog(state, event, 'ru', false)).toBeNull();
  });
});
