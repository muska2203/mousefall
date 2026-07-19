/**
 * Общие утилиты и фабрики сущностей для стратегий генерации карт.
 *
 * Содержит:
 * - Операции вырезания тайлов (carveRoom, carveHCorridor, carveVCorridor).
 * - Геометрические хелперы (roomCenter, randomPosInRoom).
 * - Фабрики сущностей (createEnemy, createFloorItem, createStairs, createDoor).
 * - Утилиты спавна врагов/предметов.
 */

import type { TileType, Room, GameState, RNGState, StairsEntity, DoorEntity, EnemyEntity, FloorItemContainerEntity, RuntimeAbility } from '@simulation/types';
import type { MapParams } from '@content/schemas';
import { rngInt, rngChance } from '@utils/rng';
import { nextEntityId } from '@simulation/state';
import { createDefaultAIState } from '@simulation/ai/ai-state';
import { getEntity, getItem, getDoor } from '@content/registry';
import { createFloorItemContainer } from '@simulation/systems/item-entity-factory';
import { createInventoryItem } from '@simulation/systems/inventory-factory';
import { addModifier } from '@simulation/systems/stats/modifier-engine';
import { recalculateActorStats } from '@simulation/systems/stats/recalculate';
import { rebuildActiveRules } from '@simulation/systems/rules/active-rule-lifecycle';

// ─────────────────────────────────────────────
// Вырезание тайлов
// ─────────────────────────────────────────────

export function carveRoom(tiles: TileType[][], room: Room): void {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      tiles[y]![x] = 'floor';
    }
  }
}

export function carveHCorridor(tiles: TileType[][], x1: number, x2: number, y: number): void {
  const [minX, maxX] = x1 < x2 ? [x1, x2] : [x2, x1];
  for (let x = minX; x <= maxX; x++) {
    tiles[y]![x] = 'floor';
  }
}

export function carveVCorridor(tiles: TileType[][], y1: number, y2: number, x: number): void {
  const [minY, maxY] = y1 < y2 ? [y1, y2] : [y2, y1];
  for (let y = minY; y <= maxY; y++) {
    tiles[y]![x] = 'floor';
  }
}

// ─────────────────────────────────────────────
// Геометрические хелперы
// ─────────────────────────────────────────────

export function roomCenter(room: Room): { x: number; y: number } {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  };
}

export function randomPosInRoom(rng: RNGState, room: Room): { x: number; y: number } {
  return {
    x: rngInt(rng, room.x + 1, room.x + room.width - 2),
    y: rngInt(rng, room.y + 1, room.y + room.height - 2),
  };
}

// ─────────────────────────────────────────────
// Спавн врагов и предметов
// ─────────────────────────────────────────────

export function spawnEnemiesAndItems(
  rng: RNGState,
  rooms: Room[],
  params: MapParams,
  state: GameState,
): { enemies: EnemyEntity[]; items: FloorItemContainerEntity[] } {
  const enemies: EnemyEntity[] = [];
  const items: FloorItemContainerEntity[] = [];
  // Отслеживаем занятые тайлы, чтобы несколько врагов не спавнились в одной клетке.
  const occupied = new Set<string>();

  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i]!;

    // Количество врагов считается от площади комнаты: 1 враг на каждые 4×4 клеток при density = 1.
    const roomArea = room.width * room.height;
    const expectedEnemies = (roomArea / 16) * params.enemyDensity;
    const guaranteedCount = Math.floor(expectedEnemies);
    const extraChance = expectedEnemies - guaranteedCount;

    for (let j = 0; j < guaranteedCount; j++) {
      spawnEnemyInRoom(rng, room, params, state, enemies, occupied);
    }

    if (extraChance > 0 && rngChance(rng, extraChance * 100)) {
      spawnEnemyInRoom(rng, room, params, state, enemies, occupied);
    }

    if (rngChance(rng, params.itemDensity * 100)) {
      const templateId = params.itemPool[rngInt(rng, 0, params.itemPool.length - 1)] ?? 'health_potion';
      const pos = randomPosInRoom(rng, room);
      items.push(createFloorItem(state, templateId, pos.x, pos.y));
    }
  }

  return { enemies, items };
}

/**
 * Пытается заспавнить одного врага внутри комнаты на свободном тайле.
 * Если подходящей клетки не нашлось (все заняты), враг не появляется.
 */
function spawnEnemyInRoom(
  rng: RNGState,
  room: Room,
  params: MapParams,
  state: GameState,
  enemies: EnemyEntity[],
  occupied: Set<string>,
): void {
  let pos = randomPosInRoom(rng, room);
  let key = `${pos.x},${pos.y}`;
  let attempts = 0;
  // Если тайл занят, пробуем подобрать свободный, но не более 10 попыток.
  while (occupied.has(key) && attempts < 10) {
    pos = randomPosInRoom(rng, room);
    key = `${pos.x},${pos.y}`;
    attempts++;
  }

  occupied.add(key);
  const templateId = params.enemyPool.length > 0
    ? params.enemyPool[rngInt(rng, 0, params.enemyPool.length - 1)]!
    : 'cat_small';
  enemies.push(createEnemy(state, templateId, pos.x, pos.y));
}

// ─────────────────────────────────────────────
// Фабрики сущностей
// ─────────────────────────────────────────────

export function createEnemy(state: GameState, templateId: string, x: number, y: number): EnemyEntity {
  const template = getEntity(templateId);

  const abilities: RuntimeAbility[] = [];

  for (const abilityId of template.abilities ?? []) {
    abilities.push({
      templateId: abilityId,
      source: 'innate',
      level: 1,
      currentCooldown: 0,
    });
  }

  const enemy: EnemyEntity = {
    id: nextEntityId(state, 'enemy'),
    type: 'enemy',
    x,
    y,
    displayName: template.id,
    hp: template.health.max,
    maxHp: template.health.max,
    damage: template.combat?.damage ?? 0,
    armor: template.combat?.armor ?? 0,
    templateId,
    statusEffects: [],
    blocksMovement: true,
    maxAp: template.maxAp ?? 1,
    ap: template.maxAp ?? 1,
    isAlive: true,
    factionId: 'enemies',
    aiStrategyId: template.aiStrategyId ?? 'hunter',
    aiSightRadius: template.aiSightRadius,
    aiState: createDefaultAIState(template.aiStrategyId ?? 'hunter', { x, y }),
    baseStats: template.baseStats,
    baseMaxHp: template.health.max,
    statModifiers: [],
    equippedWeaponId: null,
    equippedArmorId: null,
    equippedAmuletId: null,
    dodgeChance: 0,
    accuracy: 0,
    critChance: 0,
    critMultiplier: 1.5,
    abilities,
    activeRules: [],
  };

  const equipSlots = [
    { slot: 'weapon' as const, id: template.equipment?.weapon },
    { slot: 'armor' as const, id: template.equipment?.armor },
    { slot: 'amulet' as const, id: template.equipment?.amulet },
  ];

  for (const { slot, id } of equipSlots) {
    if (!id) continue;
    const itemTemplate = getItem(id);
    if (!itemTemplate) continue;

    if (slot === 'weapon') enemy.equippedWeaponId = id;
    else if (slot === 'armor') enemy.equippedArmorId = id;
    else enemy.equippedAmuletId = id;

    for (const mod of itemTemplate.equipModifiers ?? []) {
      addModifier(enemy, { ...mod, source: `equipment_${slot}` });
    }

    for (const abilityId of itemTemplate.grantedAbilities ?? []) {
      enemy.abilities.push({
        templateId: abilityId,
        source: 'equipment',
        level: 1,
        currentCooldown: 0,
      });
    }
  }

  recalculateActorStats(enemy);
  enemy.hp = enemy.maxHp;

  rebuildActiveRules(enemy);

  return enemy;
}

export function createFloorItem(
  state: GameState,
  templateId: string,
  x: number,
  y: number,
): FloorItemContainerEntity {
  const inventoryItem = createInventoryItem(state, templateId);
  return createFloorItemContainer(state, inventoryItem, { x, y });
}

export function createStairs(
  state: GameState,
  templateId: string,
  direction: 'up' | 'down',
  x: number,
  y: number,
): StairsEntity {
  return {
    id: nextEntityId(state, 'stairs'),
    type: 'stairs',
    x,
    y,
    displayName: templateId,
    templateId,
    direction,
    blocksMovement: false,
    interactionKind: 'stairs',
  };
}

export function createDoor(state: GameState, templateId: string, x: number, y: number): DoorEntity {
  const template = getDoor(templateId);
  return {
    id: nextEntityId(state, 'door'),
    type: 'door',
    x,
    y,
    displayName: templateId,
    templateId,
    blocksMovement: true,
    interactionKind: 'door',
    isOpen: false,
    hp: template.maxHp,
    maxHp: template.maxHp,
    armor: template.armor,
    isAlive: true,
  };
}
