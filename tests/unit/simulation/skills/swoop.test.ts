import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import { makeDoor, makeEnemy, makeGameState, makePlayer, createTestTerrains } from '../../../fixtures/gameState';
import {createTestSimulation} from '../../../helpers/simulation';
import {createSwoopSkill} from '../../../../src/simulation/skills/executors/swoopSkill';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {AbilityTemplate} from '../../../../src/content/schemas';
import type {GameEvent} from '../../../../src/simulation/core-types';
import {getSkillExecutor} from '../../../../src/simulation/skills/skillExecutor';
import {executeIntent} from '../../../../src/simulation/systems/intents/execute-intent';
import '@simulation/ai/hunter-strategy';
import {ExecutionBuilder} from '@simulation/systems/actions/types';
import type {ExecutionNode} from '@simulation/systems/actions/types';

/** Рекурсивно собирает события из дерева исполнения. */
function collectEvents(node: ExecutionNode, out: GameEvent[] = []): GameEvent[] {
  out.push(node.event);
  for (const child of node.children) {
    collectEvents(child, out);
  }
  return out;
}

/** Рекурсивно собирает узлы дерева исполнения. */
function collectNodes(node: ExecutionNode, out: ExecutionNode[] = []): ExecutionNode[] {
  out.push(node);
  for (const child of node.children) {
    collectNodes(child, out);
  }
  return out;
}

function mockAbility(id: string, overrides: Partial<AbilityTemplate> = {}): AbilityTemplate {
  return {
    id,
    kind: 'swoop',
    jumpRadius: 2,
    aoeRadius: 1,
    baseDamage: 8,
    cooldown: 2,
    damageTag: 'damage.physical.blunt',
    tags: ['delivery.ability', 'delivery.movement', 'attack.melee', 'target.aoe', 'effect.knockback'],
    ...overrides,
  } as AbilityTemplate;
}

/** Исполнитель базового swoop (2/1/8), собранный фабрикой — как это делает getSkillExecutor из шаблона. */
const swoopSkill = createSwoopSkill({ id: 'swoop', jumpRadius: 2, aoeRadius: 1, baseDamage: 8 });

function makeBuilder(entityId: string) {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED', isFieldEvent: false,
    action: { type: 'USE_ABILITY', entityId, abilityId: 'swoop', targets: [{ x: 0, y: 0 }] },
  });
}

describe('swoopSkill', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['swoop', mockAbility('swoop', { cooldown: 2, apCost: 2 })],
        ['guardian_swoop', mockAbility('guardian_swoop', { jumpRadius: 3, baseDamage: 10, cooldown: 2, apCost: 2, aiPreparable: true })],
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

  it('getSkillExecutor собирает исполнитель из шаблона (kind swoop)', () => {
    expect(getSkillExecutor('swoop')).toBeDefined();
  });

  it('returns valid jump targets within radius 2 excluding current cell', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const targets = swoopSkill.getValidTargets(state, player);

    // Квадрат 5×5 минус центр = 24 цели.
    expect(targets).toHaveLength(24);
    expect(targets.some(p => p.x === 5 && p.y === 5)).toBe(false);
    expect(targets.some(p => p.x === 7 && p.y === 7)).toBe(true);
    expect(targets.some(p => p.x === 3 && p.y === 3)).toBe(true);
  });

  it('excludes walls and blocked cells from valid targets', () => {
    const state = makeGameState();
    // Стена и враг в радиусе 2.
    state.map.tiles[6]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_block', x: 4, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const targets = swoopSkill.getValidTargets(state, player);

    expect(targets.some(p => p.x === 7 && p.y === 6)).toBe(false); // стена
    expect(targets.some(p => p.x === 4 && p.y === 5)).toBe(false); // занята врагом
    expect(targets.some(p => p.x === 6 && p.y === 5)).toBe(true);  // свободна
  });

  it('moves caster to empty target cell', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const jumpIntents = intents.filter(i => i.type === 'JUMP');

    expect(jumpIntents).toHaveLength(1);
    expect(jumpIntents[0]).toMatchObject({ type: 'JUMP', entityId: player.id, dx: 2, dy: 0 });
  });

  it('deals DAMAGE_TILE damage and pushes enemy in aoe', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 5, dex: 0, int: 0, vit: 0 },
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const damageTileIntents = intents.filter(i => i.type === 'DAMAGE_TILE');
    const pushIntents = intents.filter(i => i.type === 'PUSH');

    expect(damageTileIntents).toHaveLength(9);
    expect(damageTileIntents.every(i => i.tags.includes('damage.physical.blunt'))).toBe(true);
    expect(damageTileIntents.every(i => i.tags.includes('target.aoe'))).toBe(true);
    expect(pushIntents).toHaveLength(1);
    expect(pushIntents[0]).toMatchObject({ type: 'PUSH', entityId: enemy.id, dx: 0, dy: 1 });
  });

  it('does not push caster', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    // Прыжок на соседнюю клетку — кастер попадал бы в радиус 1 от цели.
    const intents = swoopSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    const pushIntents = intents.filter(i => i.type === 'PUSH').filter(i => i.entityId === player.id);

    expect(pushIntents).toHaveLength(0);
  });

  it('damages door in aoe via DAMAGE_TILE and pushes it', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const door = makeDoor({ id: 'door_1', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(door.id, door);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const doorTileIntent = intents.find(
      i => i.type === 'DAMAGE_TILE' && i.position.x === 7 && i.position.y === 6
    );
    expect(doorTileIntent).toBeDefined();

    const builder = makeBuilder(player.id);
    executeIntent(state, doorTileIntent!, builder, builder.root);

    expect(door.hp).toBeLessThan(50);
  });

  it('returns no intents when target is a wall', () => {
    const state = makeGameState();
    state.map.tiles[6]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 6 }]);
    expect(intents).toHaveLength(0);
  });

  it('returns no intents when target is occupied', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = swoopSkill.resolve(state, player, [{ x: 6, y: 5 }]);
    expect(intents).toHaveLength(0);
  });

  it('executes full leap and push into empty cell', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(7);
    expect(player.y).toBe(5);
    expect(enemy.x).toBe(7);
    expect(enemy.y).toBe(7);
    expect(enemy.hp).toBeLessThan(50);
  });

  it('pushes enemy into wall: enemy takes bump damage and is stunned', () => {
    const state = makeGameState();
    // Стена в клетке, куда враг отталкивается.
    state.map.tiles[7]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 5 }]);
    const builder = makeBuilder(player.id);

    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    expect(player.x).toBe(7);
    expect(player.y).toBe(5);
    expect(enemy.x).toBe(7);
    expect(enemy.y).toBe(6);
    expect(enemy.hp).toBeLessThan(50);
    expect(enemy.statusEffects.some(e => e.type === 'dazed')).toBe(true);
  });

  it('getTouchedPositions возвращает квадрат удара вокруг точки приземления', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const touched = swoopSkill.getTouchedPositions!(state, player, [{ x: 7, y: 5 }]);

    // Квадрат (2·aoeRadius+1)² = 9 клеток вокруг (7,5), включая центр.
    expect(touched).toHaveLength(9);
    expect(touched).toContainEqual({ x: 7, y: 5 });
    expect(touched).toContainEqual({ x: 6, y: 4 });
    expect(touched).toContainEqual({ x: 8, y: 6 });
  });

  it('getTouchedPositions пуст для недостижимой цели и без цели (derive из интентов)', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    // (0,0) — стена за пределами радиуса прыжка: интентов нет, затронутых клеток нет.
    expect(swoopSkill.getTouchedPositions!(state, player, [{ x: 0, y: 0 }])).toHaveLength(0);
    expect(swoopSkill.getTouchedPositions!(state, player, [])).toHaveLength(0);
  });

  it('полный цикл через dispatch: зона прилёта приходит дочерним событием TILES_AFFECTED', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      ap: 2,
      maxAp: 2,
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const sim = createTestSimulation(state);
    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'swoop',
      targets: [{ x: 7, y: 5 }],
    });

    expect(result.success).toBe(true);

    // На событии ABILITY_USED зоны больше нет — её несёт дочерний узел TILES_AFFECTED,
    // идущий ПОСЛЕДНИМ среди детей (после прыжка и урона): позиция в дереве
    // фиксирует момент касания для анимации.
    const abilityNode = result.phases
      .flatMap((phase) => phase.actions.flatMap((action) => collectNodes(action)))
      .find((node) => node.event.type === 'ABILITY_USED' && node.event.abilityId === 'swoop');
    expect(abilityNode).toBeDefined();
    expect(abilityNode!.event.affectedPositions).toBeUndefined();

    const childTypes = abilityNode!.children.map((node) => node.event.type);
    expect(childTypes[childTypes.length - 1]).toBe('TILES_AFFECTED');

    const tilesAffected = abilityNode!.children[childTypes.length - 1]!;
    expect(tilesAffected.event.affectedPositions).toHaveLength(9);
    expect(tilesAffected.event.affectedPositions).toContainEqual({ x: 7, y: 5 });
  });
});

describe('guardian_swoop (босс-вариант, kind swoop с дальностью 3)', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      terrains: createTestTerrains(),
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map([
        ['guardian_swoop', mockAbility('guardian_swoop', { jumpRadius: 3, baseDamage: 10, cooldown: 2, apCost: 2, aiPreparable: true })],
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

  it('getSkillExecutor собирает исполнитель с target mode range 3 из шаблона', () => {
    const executor = getSkillExecutor('guardian_swoop');

    expect(executor).toBeDefined();
    expect(executor!.id).toBe('guardian_swoop');

    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5 });
    expect(executor!.getTargetMode(state, player)).toEqual({ type: 'single', range: 3 });
  });

  it('допускает приземление на дальности 3 (квадрат 7×7 минус центр = 48 целей)', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'guardian_swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    const targets = getSkillExecutor('guardian_swoop')!.getValidTargets(state, player);

    expect(targets).toHaveLength(48);
    expect(targets.some(p => p.x === 8 && p.y === 8)).toBe(true);
    expect(targets.some(p => p.x === 5 && p.y === 5)).toBe(false);
  });

  it('прыжок на дальность 3 резолвится в JUMP и урон baseDamage шаблона', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
      abilities: [{ templateId: 'guardian_swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    state.player = player;
    state.entities.set(player.id, player);

    const intents = getSkillExecutor('guardian_swoop')!.resolve(state, player, [{ x: 8, y: 5 }]);
    const jumpIntents = intents.filter(i => i.type === 'JUMP');
    const damageTileIntents = intents.filter(i => i.type === 'DAMAGE_TILE');

    expect(jumpIntents).toHaveLength(1);
    expect(jumpIntents[0]).toMatchObject({ type: 'JUMP', entityId: player.id, dx: 3, dy: 0 });
    expect(damageTileIntents).toHaveLength(9);
    // Урон плоский: baseDamage шаблона без скейлинга от характеристик и уровня.
    expect(damageTileIntents.every(i => i.damage === 10)).toBe(true);
  });
});
