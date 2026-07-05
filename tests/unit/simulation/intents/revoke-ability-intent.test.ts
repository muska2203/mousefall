import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { executeRevokeAbilityIntent } from '../../../../src/simulation/systems/intents/revoke-ability-intent-executor';
import { ExecutionBuilder } from '../../../../src/simulation/systems/actions/types';

function makeBuilder() {
  return new ExecutionBuilder({ type: 'ACTION_APPLIED', action: { type: 'END_TURN', entityId: 'any' } });
}

describe('executeRevokeAbilityIntent', () => {
  it('удаляет только скилл с совпадающим sourceItemInstanceId', () => {
    const player = makePlayer({
      abilities: [
        { templateId: 'innate_skill', source: 'innate', level: 1, currentCooldown: 0 },
        { templateId: 'fireball', source: 'equipment', sourceItemInstanceId: 'staff_1', level: 1, currentCooldown: 0 },
        { templateId: 'heal', source: 'equipment', sourceItemInstanceId: 'amulet_1', level: 1, currentCooldown: 0 },
      ],
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeRevokeAbilityIntent(
      state,
      { type: 'REVOKE_ABILITY', entityId: 'player', sourceItemInstanceId: 'staff_1' },
      builder,
      builder.root,
    );

    expect(player.abilities).toHaveLength(2);
    expect(player.abilities.some(a => a.templateId === 'fireball')).toBe(false);
    expect(player.abilities.some(a => a.templateId === 'innate_skill')).toBe(true);
    expect(player.abilities.some(a => a.templateId === 'heal')).toBe(true);
    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('ABILITY_REVOKED');
    if (node!.event.type === 'ABILITY_REVOKED') {
      expect(node!.event.abilityId).toBe('fireball');
      expect(node!.event.sourceItemInstanceId).toBe('staff_1');
    }
  });

  it('не трогает innate-скиллы', () => {
    const player = makePlayer({
      abilities: [
        { templateId: 'slash', source: 'innate', level: 1, currentCooldown: 0 },
      ],
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeRevokeAbilityIntent(
      state,
      { type: 'REVOKE_ABILITY', entityId: 'player', sourceItemInstanceId: 'nonexistent' },
      builder,
      builder.root,
    );

    expect(player.abilities).toHaveLength(1);
    expect(player.abilities[0]!.templateId).toBe('slash');
    expect(node).toBeNull();
  });

  it('возвращает null, если сущность не найдена', () => {
    const state = makeGameState();
    const builder = makeBuilder();

    const node = executeRevokeAbilityIntent(
      state,
      { type: 'REVOKE_ABILITY', entityId: 'ghost', sourceItemInstanceId: 'staff_1' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });
});
