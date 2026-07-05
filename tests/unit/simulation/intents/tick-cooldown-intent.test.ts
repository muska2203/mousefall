import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { executeTickCooldownIntent } from '../../../../src/simulation/systems/intents/tick-cooldown-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';

describe('executeTickCooldownIntent', () => {
  it('уменьшает кулдаун способности на 1 и порождает COOLDOWN_TICKED', () => {
    const player = makePlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 2 }],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'player', round: 1, actorId: player.id });
    const node = executeTickCooldownIntent(state, { type: 'TICK_COOLDOWN', entityId: player.id, abilityId: 'fireball' }, builder, builder.root);

    expect(player.abilities[0]!.currentCooldown).toBe(1);
    expect(node).not.toBeNull();
    expect(node!.event).toMatchObject({
      type: 'COOLDOWN_TICKED',
      entityId: player.id,
      abilityId: 'fireball',
      remaining: 1,
    });
  });

  it('не опускает кулдаун ниже 0', () => {
    const player = makePlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'player', round: 1, actorId: player.id });
    executeTickCooldownIntent(state, { type: 'TICK_COOLDOWN', entityId: player.id, abilityId: 'fireball' }, builder, builder.root);

    expect(player.abilities[0]!.currentCooldown).toBe(0);
  });

  it('возвращает null для несуществующей способности', () => {
    const player = makePlayer({ abilities: [] });
    const state = makeGameState({ player, entities: new Map([[player.id, player]]) });

    const builder = new ExecutionBuilder({ type: 'TURN_BEGAN', side: 'player', round: 1, actorId: player.id });
    const node = executeTickCooldownIntent(state, { type: 'TICK_COOLDOWN', entityId: player.id, abilityId: 'fireball' }, builder, builder.root);

    expect(node).toBeNull();
  });
});
