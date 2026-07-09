import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { executeDamageIntent } from '../../../../src/simulation/systems/intents/attack-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/systems/actions/types';
import { makeEnemy, makePlayer, makeStateWithPlayerAndEntity } from '../../../fixtures/gameState';

function makeBuilder() {
  return new ExecutionBuilder({ type: 'ACTION_APPLIED', action: { type: 'END_TURN', entityId: 'any' } });
}

describe('damage tag invariant', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(global.console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('DAMAGE-интент без damage-тега вызывает console.warn', () => {
    const enemy = makeEnemy({ hp: 20, armor: 0 });
    const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
    const builder = makeBuilder();

    executeDamageIntent(state, {
      type: 'DAMAGE',
      entityId: enemy.id,
      sourceEntityId: null,
      damage: 5,
      tags: ['attack.melee'],
    }, builder, builder.root);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain('no damage tag');
  });

  it('DAMAGE-интент с несколькими damage-тегами вызывает console.warn', () => {
    const enemy = makeEnemy({ hp: 20, armor: 0 });
    const state = makeStateWithPlayerAndEntity(makePlayer(), enemy);
    const builder = makeBuilder();

    executeDamageIntent(state, {
      type: 'DAMAGE',
      entityId: enemy.id,
      sourceEntityId: null,
      damage: 5,
      tags: ['damage.physical.slashing', 'damage.magical.fire'],
    }, builder, builder.root);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain('multiple damage tags');
  });
});
