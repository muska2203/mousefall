/**
 * Unit-тесты logBuilder для observability-событий RULE_TRIGGERED.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import '@i18n/config';
import i18next from 'i18next';
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
  it('extractEvents никогда не включает RULE_TRIGGERED', () => {
    const result = makeResultWithRuleTriggered();

    expect(extractEvents(result).some((e) => e.type === 'RULE_TRIGGERED')).toBe(false);
  });

  it('gameEventToLog всегда возвращает null для RULE_TRIGGERED', () => {
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

    expect(gameEventToLog(state, event, 'ru')).toBeNull();
  });
});

describe('logBuilder новые события content rules', () => {
  beforeEach(async () => {
    await i18next.changeLanguage('ru');
  });

  function makeBaseState() {
    return makeStateWithPlayerAndEntity(makePlayer(), makeEnemy({ id: 'enemy' }));
  }

  it('STATUS_BLOCKED формирует корректную строку на русском', () => {
    const event: GameEvent = {
      type: 'STATUS_BLOCKED',
      entityId: 'player',
      sourceEntityId: 'enemy',
      statusType: 'burning',
      blockedBy: 'poisoned',
    };
    const entry = gameEventToLog(makeBaseState(), event, 'ru');
    expect(entry).not.toBeNull();
    expect(entry!.text).toBe('Герой не получил Горение: заблокировано Отравление');
    expect(entry!.variant).toBe('info');
  });

  it('STATUS_REMOVED формирует корректную строку на русском', () => {
    const event: GameEvent = {
      type: 'STATUS_REMOVED',
      entityId: 'player',
      effectType: 'burning',
    };
    const entry = gameEventToLog(makeBaseState(), event, 'ru');
    expect(entry).not.toBeNull();
    expect(entry!.text).toBe('Герой потерял Горение');
    expect(entry!.variant).toBe('info');
  });

  it('ENTITY_COLLIDED формирует корректную строку на русском', () => {
    const event: GameEvent = {
      type: 'ENTITY_COLLIDED',
      entityId: 'player',
      targetId: null,
      collisionType: 'wall',
      sourceEntityId: null,
      position: { x: 5, y: 5 },
      dx: 0,
      dy: -1,
      tags: [],
    };
    const entry = gameEventToLog(makeBaseState(), event, 'ru');
    expect(entry).not.toBeNull();
    expect(entry!.text).toBe('Герой врезался');
    expect(entry!.variant).toBe('info');
  });

  it('ENTITY_DISPLACED формирует корректную строку на русском', () => {
    const event: GameEvent = {
      type: 'ENTITY_DISPLACED',
      entityId: 'player',
      sourceEntityId: 'enemy',
      from: { x: 5, y: 5 },
      to: { x: 6, y: 5 },
      dx: 1,
      dy: 0,
    };
    const entry = gameEventToLog(makeBaseState(), event, 'ru');
    expect(entry).not.toBeNull();
    expect(entry!.text).toBe('Герой оттолкнут');
    expect(entry!.variant).toBe('info');
  });

  it('ENTITY_MISSED формирует корректную строку на русском', () => {
    const event: GameEvent = {
      type: 'ENTITY_MISSED',
      attackerId: 'player',
      targetId: 'player',
    };
    const entry = gameEventToLog(makeBaseState(), event, 'ru');
    expect(entry).not.toBeNull();
    expect(entry!.text).toBe('Герой промахнулся по Герой');
    expect(entry!.variant).toBe('info');
  });

  it('новые события формируют корректные строки на английском', async () => {
    await i18next.changeLanguage('en');
    const state = makeBaseState();

    const blocked = gameEventToLog(state, {
      type: 'STATUS_BLOCKED',
      entityId: 'player',
      sourceEntityId: 'enemy',
      statusType: 'burning',
      blockedBy: 'poisoned',
    } as GameEvent, 'en');
    expect(blocked!.text).toBe('Hero did not gain Burning: blocked by Poisoned');

    const removed = gameEventToLog(state, {
      type: 'STATUS_REMOVED',
      entityId: 'player',
      effectType: 'burning',
    } as GameEvent, 'en');
    expect(removed!.text).toBe('Hero lost Burning');

    const collided = gameEventToLog(state, {
      type: 'ENTITY_COLLIDED',
      entityId: 'player',
      targetId: null,
      collisionType: 'wall',
      sourceEntityId: null,
      position: { x: 5, y: 5 },
      dx: 0,
      dy: -1,
      tags: [],
    } as GameEvent, 'en');
    expect(collided!.text).toBe('Hero collided');

    const displaced = gameEventToLog(state, {
      type: 'ENTITY_DISPLACED',
      entityId: 'player',
      sourceEntityId: 'enemy',
      from: { x: 5, y: 5 },
      to: { x: 6, y: 5 },
      dx: 1,
      dy: 0,
    } as GameEvent, 'en');
    expect(displaced!.text).toBe('Hero was pushed');

    const missed = gameEventToLog(state, {
      type: 'ENTITY_MISSED',
      attackerId: 'player',
      targetId: 'player',
    } as GameEvent, 'en');
    expect(missed!.text).toBe('Hero missed Hero');
  });
});
