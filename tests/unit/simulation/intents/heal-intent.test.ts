import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { executeHealIntent } from '../../../../src/simulation/systems/intents/heal-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/systems/actions/types';

function makeBuilder() {
  return new ExecutionBuilder({ type: 'ACTION_APPLIED', action: { type: 'END_TURN', entityId: 'any' } });
}

describe('executeHealIntent', () => {
  it('восстанавливает HP на указанную величину', () => {
    const player = makePlayer({ hp: 50, maxHp: 100 });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeHealIntent(
      state,
      { type: 'HEAL', entityId: 'player', amount: 30 },
      builder,
      builder.root,
    );

    expect(player.hp).toBe(80);
    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('ENTITY_HEALED');
    expect((node!.event as any).amount).toBe(30);
    expect((node!.event as any).newHp).toBe(80);
  });

  it('не превышает maxHp', () => {
    const player = makePlayer({ hp: 90, maxHp: 100 });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeHealIntent(
      state,
      { type: 'HEAL', entityId: 'player', amount: 30 },
      builder,
      builder.root,
    );

    expect(player.hp).toBe(100);
    expect(node).not.toBeNull();
    expect((node!.event as any).amount).toBe(10);
  });

  it('возвращает null, если HP уже полное', () => {
    const player = makePlayer({ hp: 100, maxHp: 100 });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    const node = executeHealIntent(
      state,
      { type: 'HEAL', entityId: 'player', amount: 30 },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
    expect(player.hp).toBe(100);
  });

  it('возвращает null для несуществующей сущности', () => {
    const state = makeGameState();
    const builder = makeBuilder();

    const node = executeHealIntent(
      state,
      { type: 'HEAL', entityId: 'ghost', amount: 30 },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });
});
