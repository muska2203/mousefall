/**
 * Zod-схемы для валидации файлов сохранений.
 *
 * Используются serialization.ts для валидации сохранённых данных при загрузке.
 * Гарантируют, что повреждённые или устаревшие сохранения будут пойманы с понятными ошибками.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────
// Примитивные схемы
// ─────────────────────────────────────────────

const PositionSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

const RNGStateSchema = z.object({
  seed: z.number().int(),
  state: z.number().int(),
});

// ─────────────────────────────────────────────
// Схемы сущностей
// ─────────────────────────────────────────────

const StatusEffectSchema = z.object({
  type: z.enum([
    'poisoned',
    'burning',
    'frozen',
    'stunned',
    'regenerating',
  ]),
  duration: z.number().int().nonnegative(),
  value: z.number(),
});

const InventoryItemSchema = z.object({
  instanceId: z.string(),
  templateId: z.string(),
  quantity: z.number().int().positive(),
  grantedAbilities: z.array(
    z.object({
      templateId: z.string(),
      level: z.number().int().positive(),
    })
  ).default([]),
});

// ─────────────────────────────────────────────
// Игрок
// ─────────────────────────────────────────────

const PlayerEntitySchema = z.object({
  type: z.literal('player'),

  id: z.literal('player'),

  templateId: z.string(),

  x: z.number().int(),
  y: z.number().int(),

  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),

  damage: z.number().int().nonnegative(),
  armor: z.number().int().nonnegative(),

  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),

  inventory: z.array(InventoryItemSchema),

  equippedWeaponId: z.string().nullable(),
  equippedArmorId: z.string().nullable(),
  equippedAmuletId: z.string().nullable().optional(),
  equippedWeaponInstanceId: z.string().nullable().optional(),
  equippedArmorInstanceId: z.string().nullable().optional(),
  equippedAmuletInstanceId: z.string().nullable().optional(),

  statusEffects: z.array(StatusEffectSchema),

  blocksMovement: z.literal(true)
});

// ─────────────────────────────────────────────
// Враг
// ─────────────────────────────────────────────

const AIRuntimeStateSchema = z.object({
  behavior: z.enum([
    'aggressive',
    'passive',
    'patrol',
    'boss',
  ]),

  isAlerted: z.boolean(),

  lastKnownPlayerPos: PositionSchema.nullable(),

  patrolIndex: z.number().int().nonnegative(),
});

const EnemyEntitySchema = z.object({
  type: z.literal('enemy'),

  id: z.string(),

  x: z.number().int(),
  y: z.number().int(),

  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),

  damage: z.number().int().nonnegative(),
  armor: z.number().int().nonnegative(),

  templateId: z.string(),

  statusEffects: z.array(StatusEffectSchema),

  aiState: AIRuntimeStateSchema,

  blocksMovement: z.literal(true)
});

// ─────────────────────────────────────────────
// Предмет
// ─────────────────────────────────────────────

const ItemEntitySchema = z.object({
  type: z.literal('item'),

  id: z.string(),

  x: z.number().int(),
  y: z.number().int(),

  templateId: z.string(),

  displayName: z.string(),

  item: InventoryItemSchema,

  blocksMovement: z.literal(false)
});

// ─────────────────────────────────────────────
// Лестница
// ─────────────────────────────────────────────

const StairsEntitySchema = z.object({
  type: z.literal('stairs'),

  id: z.string(),

  x: z.number().int(),
  y: z.number().int(),

  templateId: z.string(),

  blocksMovement: z.literal(false)
});

// ─────────────────────────────────────────────
// Унифицированная схема сущности
// ─────────────────────────────────────────────

export const EntitySchema = z.discriminatedUnion('type', [
  PlayerEntitySchema,
  EnemyEntitySchema,
  ItemEntitySchema,
  StairsEntitySchema,
]);

// ─────────────────────────────────────────────
// Сериализованный Map<EntityId, Entity>
// ─────────────────────────────────────────────

const EntityMapSchema = z.array(
    z.tuple([
      z.string(), // EntityId
      EntitySchema,
    ]),
);

// ─────────────────────────────────────────────
// Схема карты
// ─────────────────────────────────────────────

const TileTypeSchema = z.enum([
  'floor',
  'wall'
]);

const RoomSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const GameMapSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),

  tiles: z.array(
      z.array(TileTypeSchema),
  ),

  rooms: z.array(RoomSchema),
});

// ─────────────────────────────────────────────
// Полная схема GameState
// ─────────────────────────────────────────────

const RunStatsSchema = z.object({
  startTime: z.number().int(),
  enemiesKilled: z.number().int().nonnegative(),
  chestsOpened: z.number().int().nonnegative(),
  itemsPickedUp: z.number().int().nonnegative(),
});

export const GameStateSchema = z.object({
  map: GameMapSchema,

  player: PlayerEntitySchema,

  entities: EntityMapSchema,

  visible: z.array(
      z.array(z.boolean()),
  ),

  explored: z.array(
      z.array(z.boolean()),
  ),

  turn: z.enum([
    'player',
    'ai',
  ]),

  turnNumber: z.number()
      .int()
      .nonnegative(),

  phase: z.enum([
    'playing',
    'dead',
    'victory',
  ]),

  floor: z.number()
      .int()
      .positive(),

  rng: RNGStateSchema,

  runStats: RunStatsSchema,
});

// ─────────────────────────────────────────────
// Схема файла сохранения
// ─────────────────────────────────────────────

export const SaveFileSchema = z.object({
  version: z.number()
      .int()
      .positive(),

  savedAt: z.string(),

  floorNumber: z.number()
      .int()
      .positive(),

  turnNumber: z.number()
      .int()
      .nonnegative(),

  gameState: GameStateSchema,
});

export type SaveFile = z.infer<typeof SaveFileSchema>;