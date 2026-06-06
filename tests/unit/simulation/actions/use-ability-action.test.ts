import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { useAbilityAction } from '../../../../src/simulation/systems/actions/use-ability-action';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { AbilityTemplate } from '../../../../src/content/schemas';
import { ExecutionBuilder } from '../../../../src/simulation/systems/actions/types';
import { initSkillRegistry } from '../../../../src/simulation/skills/index';

beforeEach(() => {
  initSkillRegistry();
});

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    cooldown: 3,
    ...overrides,
  } as AbilityTemplate;
}

describe('useAbilityAction', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { cooldown: 3 })],
      ]),
      maps: new Map(),
      stairs: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('blocks usage when ability is on cooldown', () => {
    const state = makeGameState();
    const player = makePlayer({
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 2 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ABILITY' as const, entityId: 'player', abilityId: 'fireball', targets: [{ x: 6, y: 5 }] };
    const result = useAbilityAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('ability_on_cooldown');
    }
  });

  it('blocks usage for invalid target', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    // target out of range
    const action = { type: 'USE_ABILITY' as const, entityId: 'player', abilityId: 'fireball', targets: [{ x: 20, y: 20 }] };
    const result = useAbilityAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('invalid_target');
    }
  });

  it('allows usage with valid target and deducts MP/cooldown on execute', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ABILITY' as const, entityId: 'player', abilityId: 'fireball', targets: [{ x: 6, y: 5 }] };
    const validation = useAbilityAction.validate(state, action);
    if (!validation.ok) {
      console.log('Validation failed:', validation.reasonCode);
    }
    expect(validation.ok).toBe(true);

    const intents = useAbilityAction.resolve(state, action);
    const builder = new ExecutionBuilder({ type: 'ACTION_APPLIED', action });
    useAbilityAction.execute(state, action, intents, builder, builder.root);

    const ability = player.abilities.find(a => a.templateId === 'fireball');
    expect(ability?.currentCooldown).toBe(3);
  });

  it('blocks usage when already casting', () => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { castTime: 2 })],
      ]),
      maps: new Map(),
      stairs: new Map(),
    });
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
      activeCast: { abilityId: 'fireball', fixedTargets: [{ x: 6, y: 5 }], remainingTurns: 1 },
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ABILITY' as const, entityId: 'player', abilityId: 'fireball', targets: [{ x: 6, y: 5 }] };
    const result = useAbilityAction.validate(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe('already_casting');
    }
  });

  it('does not set cooldown for castTime > 0 on resolve, uses BEGIN_CAST instead', () => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['fireball', mockAbility('fireball', { castTime: 2 })],
      ]),
      maps: new Map(),
      stairs: new Map(),
    });
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ABILITY' as const, entityId: 'player', abilityId: 'fireball', targets: [{ x: 6, y: 5 }] };
    const intents = useAbilityAction.resolve(state, action);

    expect(intents.some(i => i.type === 'SET_COOLDOWN')).toBe(false);
    expect(intents.some(i => i.type === 'BEGIN_CAST')).toBe(true);
  });

  it('places intents as children of ABILITY_USED event in execution tree', () => {
    const state = makeGameState();
    state.visible[5]![5] = true;
    state.visible[5]![6] = true;
    const player = makePlayer({
      x: 5,
      y: 5,
      abilities: [{ templateId: 'fireball', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const action = { type: 'USE_ABILITY' as const, entityId: 'player', abilityId: 'fireball', targets: [{ x: 6, y: 5 }] };
    const intents = useAbilityAction.resolve(state, action);
    const builder = new ExecutionBuilder({ type: 'ACTION_APPLIED', action });
    useAbilityAction.execute(state, action, intents, builder, builder.root);

    // Корень: ACTION_APPLIED
    expect(builder.root.event.type).toBe('ACTION_APPLIED');
    // У корня один ребёнок: ABILITY_USED
    expect(builder.root.children).toHaveLength(1);
    expect(builder.root.children[0]!.event.type).toBe('ABILITY_USED');

    // Интенты должны быть детьми ABILITY_USED, а не сиблингами корню
    const abilityNode = builder.root.children[0]!;
    expect(abilityNode.children.length).toBeGreaterThan(0);
    const intentEventTypes = abilityNode.children.map(c => c.event.type);
    // У корня только один ребёнок — ABILITY_USED
    expect(builder.root.children).toHaveLength(1);
  });
});
