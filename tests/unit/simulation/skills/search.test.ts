import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createTestTerrains, makeDoor, makeEnemy, makeGameState, makePlayer, makeTrap} from '../../../fixtures/gameState';
import {createTestSimulation} from '../../../helpers/simulation';
import {createSearchSkill} from '../../../../src/simulation/skills/executors/searchSkill';
import {getSkillExecutor} from '../../../../src/simulation/skills/skillExecutor';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {AbilityTemplate} from '../../../../src/content/schemas';
import type {GameEvent} from '../../../../src/simulation/core-types';
import type {ExecutionNode} from '../../../../src/simulation/systems/actions/types';

function mockSearchAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    kind: 'search',
    radius: 3,
    cooldown: 0,
    apCost: 1,
    aiPreparable: false,
    tags: ['delivery.ability'],
    ...overrides,
  } as AbilityTemplate;
}

/** Исполнитель search (радиус 3), собранный фабрикой — как это делает getSkillExecutor из шаблона. */
const searchSkill = createSearchSkill({ id: 'search', radius: 3 });

/** Рекурсивно собирает события из дерева исполнения. */
function collectEvents(node: ExecutionNode, out: GameEvent[] = []): GameEvent[] {
  out.push(node.event);
  for (const child of node.children) {
    collectEvents(child, out);
  }
  return out;
}

describe('searchSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['search', mockSearchAbility('search')],
      ]),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
      statuses: new Map(),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('getSkillExecutor собирает исполнитель из шаблона (kind search), режим таргетинга — self', () => {
    const executor = getSkillExecutor('search');

    expect(executor).toBeDefined();
    expect(executor!.id).toBe('search');

    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    expect(executor!.getTargetMode(state, player)).toEqual({ type: 'self' });
    expect(executor!.getValidTargets(state, player)).toEqual([{ x: 5, y: 5 }]);
  });

  it('resolve раскрывает скрытую ловушку в радиусе и в прямой видимости', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const trap = makeTrap({ id: 'trap_1', x: 7, y: 7, hidden: true });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(trap.id, trap);

    const intents = searchSkill.resolve(state, player, []);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ type: 'REVEAL_OBJECT', entityId: 'trap_1' });
  });

  it('resolve игнорирует ловушку вне радиуса поиска', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 2, y: 2 });
    // Чебышёвская дистанция 4 — вне radius 3.
    const trap = makeTrap({ id: 'trap_1', x: 6, y: 2, hidden: true });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(trap.id, trap);

    expect(searchSkill.resolve(state, player, [])).toHaveLength(0);
  });

  it('resolve игнорирует ловушку без прямой видимости (за закрытой дверью)', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const door = makeDoor({ id: 'door_1', x: 6, y: 5 });
    const trap = makeTrap({ id: 'trap_1', x: 7, y: 5, hidden: true });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);
    state.entities.set(trap.id, trap);

    expect(searchSkill.resolve(state, player, [])).toHaveLength(0);
  });

  it('resolve игнорирует уже раскрытые ловушки и сущности других типов', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const revealedTrap = makeTrap({ id: 'trap_1', x: 6, y: 5, hidden: false });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 6 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(revealedTrap.id, revealedTrap);
    state.entities.set(enemy.id, enemy);

    expect(searchSkill.resolve(state, player, [])).toHaveLength(0);
  });

  it('resolve при нескольких находках возвращает интенты в детерминированном порядке (по id)', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    const trapB = makeTrap({ id: 'trap_b', x: 6, y: 5, hidden: true });
    const trapA = makeTrap({ id: 'trap_a', x: 4, y: 5, hidden: true });
    state.player = player;
    state.entities.set(player.id, player);
    // Намеренно добавляем в «непорядковом» порядке.
    state.entities.set(trapB.id, trapB);
    state.entities.set(trapA.id, trapA);

    const intents = searchSkill.resolve(state, player, []);

    expect(intents).toHaveLength(2);
    expect(intents[0]).toMatchObject({ type: 'REVEAL_OBJECT', entityId: 'trap_a' });
    expect(intents[1]).toMatchObject({ type: 'REVEAL_OBJECT', entityId: 'trap_b' });
  });

  it('полный цикл через dispatch: USE_ABILITY раскрывает ловушку (OBJECT_REVEALED) и списывает AP', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 2,
      maxAp: 2,
      abilities: [{ templateId: 'search', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const trap = makeTrap({ id: 'trap_1', x: 7, y: 7, hidden: true });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(trap.id, trap);

    const sim = createTestSimulation(state);
    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'search',
      targets: [],
    });

    expect(result.success).toBe(true);
    expect(trap.hidden).toBe(false);
    expect(player.ap).toBe(1);

    const events = result.phases.flatMap((phase) =>
      phase.actions.flatMap((action) => collectEvents(action)));
    expect(events.some((e) => e.type === 'OBJECT_REVEALED' && e.entityId === 'trap_1')).toBe(true);
    expect(events.some((e) => e.type === 'ABILITY_USED' && e.abilityId === 'search')).toBe(true);
  });

  it('полный цикл через dispatch: пустой поиск списывает AP и ничего не раскрывает', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 2,
      maxAp: 2,
      abilities: [{ templateId: 'search', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    // Ловушка за пределами радиуса — находок нет.
    const trap = makeTrap({ id: 'trap_1', x: 1, y: 1, hidden: true });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(trap.id, trap);

    const sim = createTestSimulation(state);
    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'search',
      targets: [],
    });

    expect(result.success).toBe(true);
    expect(player.ap).toBe(1);
    expect(trap.hidden).toBe(true);

    const events = result.phases.flatMap((phase) =>
      phase.actions.flatMap((action) => collectEvents(action)));
    expect(events.some((e) => e.type === 'OBJECT_REVEALED')).toBe(false);
  });
});
