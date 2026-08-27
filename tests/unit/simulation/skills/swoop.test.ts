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

  it('клетка с живым актором — валидная цель (подставка), стена и блокирующий объект — нет', () => {
    const state = makeGameState();
    // Стена, закрытая дверь и враг в радиусе 2.
    state.map.tiles[6]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_block', x: 4, y: 5 });
    const door = makeDoor({ id: 'door_block', x: 3, y: 5, isOpen: false, blocksMovement: true });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);
    state.entities.set(door.id, door);

    const targets = swoopSkill.getValidTargets(state, player);

    expect(targets.some(p => p.x === 7 && p.y === 6)).toBe(false); // стена
    expect(targets.some(p => p.x === 3 && p.y === 5)).toBe(false); // закрытая дверь
    expect(targets.some(p => p.x === 4 && p.y === 5)).toBe(true);  // занята врагом — подставка
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

    // Квадрат 3×3 минус центральная клетка (там кастер после прыжка).
    expect(damageTileIntents).toHaveLength(8);
    expect(damageTileIntents.some(i => i.position.x === 7 && i.position.y === 5)).toBe(false);
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

  it('отскок от стены: урона нет, кастер получает dazed и JUMP в клетку отброса', () => {
    const state = makeGameState();
    state.map.tiles[6]![7] = 'wall';
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    state.player = player;
    state.entities.set(player.id, player);

    // Устаревший подготовленный прицел: resolve вызывается напрямую, минуя validate.
    const intents = swoopSkill.resolve(state, player, [{ x: 7, y: 6 }]);

    expect(intents.filter(i => i.type === 'DAMAGE_TILE')).toHaveLength(0);
    expect(intents.filter(i => i.type === 'PUSH')).toHaveLength(0);

    // Ближайшая к началу каста свободная клетка вокруг (7,6) — (6,5).
    const jump = intents.find(i => i.type === 'JUMP');
    expect(jump).toMatchObject({ type: 'JUMP', entityId: player.id, dx: 1, dy: 0 });

    const daze = intents.find(i => i.type === 'APPLY_STATUS');
    expect(daze).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: player.id,
      status: { type: 'dazed', duration: 1 },
    });
  });

  it('подставка: resolve в клетку с врагом — двойной урон по центру, кольцо AoE и PUSH жертве, JUMP кастера на её место', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = swoopSkill.resolve(state, player, [{ x: 6, y: 5 }]);

    // Клетка жертвы — один удар с удвоенным уроном, кольцо вокруг — базовый AoE.
    const damageTileIntents = intents.filter(i => i.type === 'DAMAGE_TILE');
    expect(damageTileIntents).toHaveLength(9);
    const victimTile = damageTileIntents.filter(i => i.position.x === 6 && i.position.y === 5);
    expect(victimTile).toHaveLength(1);
    expect(victimTile[0]).toMatchObject({
      damage: 16, // baseDamage 8 × 2
      excludeEntityId: player.id,
    });
    expect(victimTile[0]!.tags.includes('damage.physical.blunt')).toBe(true);
    expect(damageTileIntents.filter(i => i !== victimTile[0]).every(i => i.damage === 8)).toBe(true);

    // Других сущностей рядом нет: отталкивание одно — жертвы, прочь от кастера.
    // Ближайшие свободные клетки с максимальной дистанцией от (5,5): (7,4) и (7,6) — тай-брейк по y.
    const pushIntents = intents.filter(i => i.type === 'PUSH');
    expect(pushIntents).toHaveLength(1);
    expect(pushIntents[0]).toMatchObject({ type: 'PUSH', entityId: enemy.id, dx: 1, dy: -1 });

    // Кастер приземляется на освободившуюся клетку жертвы.
    const jumpIntents = intents.filter(i => i.type === 'JUMP');
    expect(jumpIntents).toHaveLength(1);
    expect(jumpIntents[0]).toMatchObject({ type: 'JUMP', entityId: player.id, dx: 1, dy: 0 });

    // Жертва подставки ошеломления не получает.
    expect(intents.some(i => i.type === 'APPLY_STATUS')).toBe(false);
  });

  it('подставка через dispatch: жертва получает двойной урон и отброс; кастер приземляется на её клетку, соседи получают AoE-урон и отталкивание', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      hp: 30,
      maxHp: 30,
      ap: 2,
      maxAp: 2,
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    const neighbor = makeEnemy({ id: 'enemy_2', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);
    state.entities.set(neighbor.id, neighbor);

    const sim = createTestSimulation(state);
    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'swoop',
      targets: [{ x: 6, y: 5 }],
    });

    expect(result.success).toBe(true);
    expect(enemy.hp).toBe(50 - 16);
    // Жертва подставки ошеломления не получает.
    expect(enemy.statusEffects.some(e => e.type === 'dazed')).toBe(false);
    // Жертву отпихнуло на ближайшую свободную клетку прочь от кастера — (7,4).
    expect(enemy.x).toBe(7);
    expect(enemy.y).toBe(4);
    // Сосед в кольце AoE получает базовый урон и радиальный толчок от центра (6,5).
    expect(neighbor.hp).toBe(50 - 8);
    expect(neighbor.x).toBe(8);
    expect(neighbor.y).toBe(7);
    // Кастер не получил урон и приземлился на клетку жертвы.
    expect(player.hp).toBe(30);
    expect(player.x).toBe(6);
    expect(player.y).toBe(5);
  });

  it('подставка по жертве под «Глухой обороной»: толчок гасится, кастер отбрасывается к началу каста (fallback)', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({
      id: 'enemy_1',
      x: 6,
      y: 5,
      hp: 50,
      maxHp: 50,
      armor: 0,
      statusEffects: [{ type: 'bulwark', duration: 1, value: 0, statModifiers: null }],
    });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const intents = swoopSkill.resolve(state, player, [{ x: 6, y: 5 }]);

    // Точечный урон и кольцо AoE проходят и в fallback: 1 двойной + 8 базовых.
    // Толчка жертвы нет — вместо него кастер отбрасывается сам.
    expect(intents.filter(i => i.type === 'DAMAGE_TILE')).toHaveLength(9);
    expect(intents.some(i => i.type === 'PUSH' && i.entityId === enemy.id)).toBe(false);

    const builder = makeBuilder(player.id);
    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    // Жертва не сдвинулась, кастер отброшен на ближайшую к началу свободную клетку — саму исходную.
    expect(enemy.x).toBe(6);
    expect(enemy.y).toBe(5);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    // Урон обнуляется неуязвимостью bulwark; ошеломления у жертвы подставки нет.
    expect(enemy.hp).toBe(50);
    expect(enemy.statusEffects.some(e => e.type === 'dazed')).toBe(false);
  });

  it('подставка по недвижимой жертве через dispatch: соседи получают AoE-урон и отталкивание, кастер отброшен к началу каста', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      hp: 30,
      maxHp: 30,
      ap: 2,
      maxAp: 2,
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({
      id: 'enemy_1',
      x: 6,
      y: 5,
      hp: 50,
      maxHp: 50,
      armor: 0,
      statusEffects: [{ type: 'bulwark', duration: 1, value: 0, statModifiers: null }],
    });
    const neighbor = makeEnemy({ id: 'enemy_2', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);
    state.entities.set(neighbor.id, neighbor);

    const sim = createTestSimulation(state);
    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'swoop',
      targets: [{ x: 6, y: 5 }],
    });

    expect(result.success).toBe(true);
    // Жертва-«bulwark» не получила урон, не сдвинулась и не оглушена.
    expect(enemy.hp).toBe(50);
    expect(enemy.x).toBe(6);
    expect(enemy.y).toBe(5);
    expect(enemy.statusEffects.some(e => e.type === 'dazed')).toBe(false);
    // Сосед в кольце AoE получает базовый урон и радиальный толчок от центра (6,5).
    expect(neighbor.hp).toBe(50 - 8);
    expect(neighbor.x).toBe(8);
    expect(neighbor.y).toBe(7);
    // Кастер отброшен на исходную клетку и не получил урон от своего AoE.
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    expect(player.hp).toBe(30);
  });

  it('подставка при замурованной цели: отброс возвращает кастера на исходную клетку (fallback)', () => {
    // Исполнитель с дальностью 3, чтобы исходная клетка не попадала в кольца отброса.
    const skill = createSwoopSkill({ id: 'swoop', jumpRadius: 3, aoeRadius: 1, baseDamage: 8 });
    const state = makeGameState();
    const player = makePlayer({ x: 4, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 5, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    // Кольца 1–2 вокруг (7,5) замурованы: жертву некуда отпихнуть (все соседние
    // клетки заняты), срабатывает fallback — кастер отбрасывается к началу каста.
    for (let y = 3; y <= 7; y++) {
      for (let x = 5; x <= 9; x++) {
        if (x === 7 && y === 5) continue;
        state.map.tiles[y]![x] = 'wall';
      }
    }

    const intents = skill.resolve(state, player, [{ x: 7, y: 5 }]);
    const builder = makeBuilder(player.id);
    for (const intent of intents) {
      executeIntent(state, intent, builder, builder.root);
    }

    // Fallback отброса — исходная клетка кастера.
    expect(player.x).toBe(4);
    expect(player.y).toBe(5);
    expect(enemy.hp).toBe(50 - 16);
    expect(enemy.statusEffects.some(e => e.type === 'dazed')).toBe(false);
  });

  it('приземление на пустую клетку через dispatch: кастер не получает урон, враг в зоне — получает (регрессия самоурона)', () => {
    const state = makeGameState();
    const player = makePlayer({
      x: 5,
      y: 5,
      hp: 30,
      maxHp: 30,
      ap: 2,
      maxAp: 2,
      abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }],
    });
    const enemy = makeEnemy({ id: 'enemy_1', x: 7, y: 6, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const sim = createTestSimulation(state);
    const result = sim.dispatch({
      type: 'USE_ABILITY',
      entityId: player.id,
      abilityId: 'swoop',
      targets: [{ x: 7, y: 5 }],
    });

    expect(result.success).toBe(true);
    expect(player.x).toBe(7);
    expect(player.y).toBe(5);
    // Кастер стоит в центре зоны удара, но не задет (excludeEntityId).
    expect(player.hp).toBe(30);
    expect(enemy.hp).toBeLessThan(50);
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

    // Квадрат (2·aoeRadius+1)² = 9 клеток вокруг (7,5) минус центр
    // (центральная клетка не получает DAMAGE_TILE — после прыжка там кастер).
    expect(touched).toHaveLength(8);
    expect(touched).not.toContainEqual({ x: 7, y: 5 });
    expect(touched).toContainEqual({ x: 6, y: 4 });
    expect(touched).toContainEqual({ x: 8, y: 6 });
  });

  it('getTouchedPositions при подставке возвращает полный квадрат: клетка жертвы + кольцо AoE', () => {
    const state = makeGameState();
    const player = makePlayer({ x: 5, y: 5, abilities: [{ templateId: 'swoop', source: 'innate', level: 1, currentCooldown: 0 }] });
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 50, maxHp: 50, armor: 0 });
    state.player = player;
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);

    const touched = swoopSkill.getTouchedPositions!(state, player, [{ x: 6, y: 5 }]);

    // Клетка жертвы (удвоенный урон) + 8 клеток кольца AoE.
    expect(touched).toHaveLength(9);
    expect(touched).toContainEqual({ x: 6, y: 5 });
    expect(touched).toContainEqual({ x: 5, y: 4 });
    expect(touched).toContainEqual({ x: 7, y: 6 });
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
    expect(tilesAffected.event.affectedPositions).toHaveLength(8);
    expect(tilesAffected.event.affectedPositions).not.toContainEqual({ x: 7, y: 5 });
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
    // Квадрат 3×3 минус центральная клетка (там кастер после прыжка).
    expect(damageTileIntents).toHaveLength(8);
    // Урон плоский: baseDamage шаблона без скейлинга от характеристик и уровня.
    expect(damageTileIntents.every(i => i.damage === 10)).toBe(true);
  });
});
