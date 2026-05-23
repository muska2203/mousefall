/**
 * Базовые типы слоя симуляции.
 *
 * Правила:
 * - Все типы должны быть JSON-сериализуемы (без функций, экземпляров классов, Symbols)
 * - Никаких опциональных полей, если они не опциональны в рантайме (используйте явный null)
 * - Предпочитайте плоские структуры вместо глубокой вложенности
 * - У каждой сущности есть стабильный строковый ID (используется для детерминированной сортировки)
 */

// ─────────────────────────────────────────────
// Примитивы
// ─────────────────────────────────────────────

import {ENTITY_TYPE} from "@utils/constants.ts";
import type {MapParams} from "./schemas/contentSchemas";
import {ExecutionNode, GameAction} from "@simulation/systems/actions/types.ts";
import {Intent} from "@simulation/systems/intents/types.ts";

/** Координата сетки. x = столбец (слева направо), y = строка (сверху вниз). */
export type Position = {
  readonly x: number;
  readonly y: number;
};

/** Уникальный идентификатор сущности. Стабилен между ходами. */
export type EntityId = string;

/** Уникальный идентификатор экземпляра предмета. */
export type ItemInstanceId = string;

// ─────────────────────────────────────────────
// Карта / Мир
// ─────────────────────────────────────────────

export type TileType =
  | 'floor'
  | 'wall';

export type Room = {
  /** Левый верхний угол */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GameMap = {
  width: number;
  height: number;
  /** Плотный двумерный массив. Доступ как tiles[y][x]. */
  tiles: TileType[][];
  /** Метаданные комнат из генератора карты (используются для размещения врагов/предметов). */
  rooms: Room[];
};

// ─────────────────────────────────────────────
// Сущности
// ─────────────────────────────────────────────

/** Экземпляр предмета, находящийся в инвентаре сущности. */
export type InventoryItem = {
  instanceId: ItemInstanceId;
  /** Ссылается на шаблон в реестре контента. */
  templateId: string;
  quantity: number;
};

export type Entity =
    | PlayerEntity
    | EnemyEntity
    | ItemEntity
    | StairsEntity;


export type EntityType =
    typeof ENTITY_TYPE[keyof typeof ENTITY_TYPE];

export interface BaseEntity {
  id: EntityId;
  type: EntityType;
  x: number;
  y: number;
  blocksMovement: boolean;
}

export interface BaseStats {
  str: number;
  dex: number;
  int: number;
  vit: number;
}

export type StatModifierOp = 'add' | 'multiply';

export type StatModifier = {
  stat: 'damage' | 'armor' | 'maxHp' | 'maxMp' | 'dodgeChance' | 'accuracy' | 'critChance' | 'critMultiplier' | 'str' | 'dex' | 'int' | 'vit';
  value: number;
  op: StatModifierOp;
  source: string;
  charges?: number;
};

export interface Attacker {
  damage: number;
}

export interface Attackable {
  hp: number;
  maxHp: number;
  armor: number;
  isAlive?: boolean;
}

export interface StatusEffectHolder {
  statusEffects: StatusEffect[];
}

export interface TemplateIdHolder {
  templateId: string;
}

export interface Actor extends BaseEntity, Attackable, Attacker {
  maxAp: number;
  ap: number;
}

export interface AiActor extends Actor {
  aiStrategyId: string;
}

/** Сущность игрока. Всегда присутствует в GameState.
 *
 * Важно: поля damage, armor, maxHp, maxMp являются derived-кэшем.
 * Их нельзя менять напрямую — только через recalculatePlayerBaseStats().
 */
export interface PlayerEntity extends Actor, StatusEffectHolder {
  id: 'player';
  type: 'player';
  blocksMovement: true;
  /** Опыт, накопленный за текущий забег. */
  xp: number;
  /** Текущий уровень. */
  level: number;
  inventory: InventoryItem[];
  /** ID экипированного шаблона оружия или null. */
  equippedWeaponId: string | null;
  /** ID экипированного шаблона брони или null. */
  equippedArmorId: string | null;
  /** ID экипированного амулета или null. */
  equippedAmuletId: string | null;
  /** Текущая мана. */
  mp: number;
  /** Максимальная мана (базовая, без модификаторов). */
  maxMp: number;
  /** Базовые характеристики. */
  baseStats: BaseStats;
  /** Активные модификаторы (баффы, дебаффы, эффекты экипировки). */
  statModifiers: StatModifier[];
}

/** Сущность врага на карте. */
export interface EnemyEntity extends AiActor, StatusEffectHolder, TemplateIdHolder {
  /** Активные эффекты статуса. */
  /** Состояние ИИ в рантайме (сохраняется для памяти патруля/погони). */
  type: 'enemy';
  blocksMovement: true;
}

/** Предмет, лежащий на полу карты. */
export interface ItemEntity extends BaseEntity, TemplateIdHolder {
  type: 'item';
  blocksMovement: false;
  quantity: number;
}

/** Лестница — объект перехода между этажами. */
export interface StairsEntity extends BaseEntity {
  type: 'stairs';
  blocksMovement: false;
  direction: 'down' | 'up';
}

// ─────────────────────────────────────────────
// Эффекты статуса
// ─────────────────────────────────────────────

export type StatusEffectType =
  | 'poisoned'
  | 'burning'
  | 'frozen'
  | 'stunned'
  | 'regenerating';

export type StatusEffect = {
  type: StatusEffectType;
  /** Оставшиеся ходы. */
  duration: number;
  /** Величина эффекта (урон в ход, лечение в ход и т.д.). */
  value: number;
  statModifiers?: StatModifier[];
};

// ─────────────────────────────────────────────
// Состояние ИИ в рантайме
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Генератор случайных чисел
// ─────────────────────────────────────────────

/**
 * Состояние seeded PRNG. Хранится в GameState для детерминизма.
 * Вся случайность в симуляции ДОЛЖНА проходить через него.
 * Никогда не используйте Math.random() в коде симуляции.
 */
export type RNGState = {
  /** Исходный seed — для отображения и обмена. Никогда не меняется. */
  seed: number;
  /** Текущее внутреннее состояние PRNG — продвигается при каждом использовании. */
  state: number;
};

// ─────────────────────────────────────────────
// Система ходов
// ─────────────────────────────────────────────

export type TurnSide = 'PLAYER' | 'ENVIRONMENT';

type TurnState = {
  activeSide: TurnSide;
  round: number;
};

export type GamePhase = 'playing' | 'dead' | 'victory';

// ─────────────────────────────────────────────
// Игровое состояние
// ─────────────────────────────────────────────

/**
 * Полное сериализуемое игровое состояние.
 *
 * Это единственный источник истины для симуляции.
 * Здесь есть всё, что нужно для отрисовки игры и возобновления сессии.
 *
 * Контракт сериализации:
 * - Все поля — примитивы, массивы или plain-объекты, сериализуемые в JSON
 * - Никаких экземпляров классов, функций, Symbols, undefined
 * - Состояние RNG включено — необходимо для детерминированного воспроизведения из сохранения
 */
export type GameState = {
  // ── World ──────────────────────────────────────────────────────────
  map: GameMap;

  // ── Map Generation Params ──────────────────────────────────────────
  /** Параметры генерации карты для текущего и новых этажей. */
  mapParams: MapParams;

  // ── Entities ───────────────────────────────────────────────────────
  entities: Map<EntityId, Entity>;
  player: PlayerEntity;

  // ── Fog of War ─────────────────────────────────────────────────────
  /** Клетки, видимые игроку в данный момент. Доступ как visible[y][x]. */
  visible: boolean[][];
  /** Клетки, которые игрок видел хотя бы один раз. Доступ как explored[y][x]. */
  explored: boolean[][];

  // ── Turn Management ────────────────────────────────────────────────
  turn: TurnState;

  // ── Game Progress ──────────────────────────────────────────────────
  phase: GamePhase;
  /** Текущий этаж подземелья (нумерация с 1). */
  floor: number;

  // ── Floor Snapshots ────────────────────────────────────────────────
  /** Посещённые этажи. Индекс = floor − 1. Текущий этаж не дублируется здесь. */
  floorSnapshots: FloorSnapshot[];

  // ── Randomness ─────────────────────────────────────────────────────
  /**
   * Состояние seeded PRNG. Мутируется системами симуляции.
   * Сериализуется вместе с сохранениями для обеспечения детерминизма при загрузке.
   */
  rng: RNGState;

  // ── Entity ID counter ──────────────────────────────────────────────
  /**
   * Монотонный счётчик для детерминированной генерации ID сущностей.
   * Увеличивается функцией `nextEntityId`. Сериализуется для детерминизма.
   */
  nextEntityCounter: number;
};

// ─────────────────────────────────────────────
// Доменные события
// ─────────────────────────────────────────────

/**
 * Доменные события возвращаются функциями симуляции вместе с мутациями состояния.
 * Они описывают, что произошло, — используются UI только для визуальной обратной связи.
 *
 * Правила:
 * - События — plain-данные (без функций, без колбэков)
 * - События порождаются симуляцией и потребляются UI
 * - События эфемерны — не сохраняются, не воспроизводятся
 * - UI может игнорировать любое событие
 * - Симуляция никогда не читает события
 */
export type GameEvent =
    | ActionAppliedEvent
    | ActionRejectedEvent
    | EntityMovedEvent
    | EntityDamagedEvent
    | EntityDiedEvent
    | EntityMissedEvent
    | ItemPickedUpEvent
    | ItemDroppedEvent
    | ItemUsedEvent
    | DoorOpenedEvent
    | DoorClosedEvent
    | StairExitTriggeredEvent
    | FloorChangedEvent
    | TurnEndedEvent
    | PlayerDiedEvent
    | PlayerLeveledUpEvent
    | FogUpdatedEvent
    | StatusAppliedEvent
    | StatusRemovedEvent
    | StatusTickedEvent;

export type ActionAppliedEvent = { type: 'ACTION_APPLIED'; action: GameAction }

export type ActionRejectedEvent = { type: 'ACTION_REJECTED'; errors: ValidationError[] };

export type EntityMovedEvent = { type: 'ENTITY_MOVED'; entityId: EntityId; from: Position; to: Position };

export type EntityDamagedEvent = { type: 'ENTITY_DAMAGED'; targetId: EntityId; damage: number; position: Position };

export type EntityDiedEvent = { type: 'ENTITY_DIED'; entityId: EntityId; position: Position};

export type EntityMissedEvent = { type: 'ENTITY_MISSED'; attackerId: EntityId; targetId: EntityId };

export type ItemPickedUpEvent = { type: 'ITEM_PICKED_UP'; entityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string };

export type ItemDroppedEvent = { type: 'ITEM_DROPPED'; entityId: EntityId; itemInstanceId: ItemInstanceId; position: Position };

export type ItemUsedEvent = { type: 'ITEM_USED'; entityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string };

export type DoorOpenedEvent = { type: 'DOOR_OPENED'; position: Position };

export type DoorClosedEvent = { type: 'DOOR_CLOSED'; position: Position };

export type StairExitTriggeredEvent = { type: 'STAIR_EXIT_TRIGGERED'; direction: 'down' | 'up' };

export type FloorChangedEvent = { type: 'FLOOR_CHANGED'; from: number; to: number };

export type TurnEndedEvent = { type: 'TURN_ENDED'; turnNumber: number };

export type PlayerDiedEvent = { type: 'PLAYER_DIED' };

export type PlayerLeveledUpEvent = { type: 'PLAYER_LEVELED_UP'; newLevel: number };

export type FogUpdatedEvent = { type: 'FOG_UPDATED'; newlyVisible: Position[] };

export type StatusAppliedEvent = { type: 'STATUS_APPLIED'; entityId: EntityId; effect: StatusEffect };

export type StatusRemovedEvent = { type: 'STATUS_REMOVED'; entityId: EntityId; effectType: StatusEffectType };

export type StatusTickedEvent = { type: 'STATUS_TICKED'; entityId: EntityId; effectType: StatusEffectType; value: number };


export type ValidationResult =
  | { ok: true }
  | { ok: false; reasonCode: string; reasonDescription: string };


export type Simulation = {
  dispatch(action: GameAction): SimulationResult;

  preview(action: GameAction): ActionPreview;

  getState(): Readonly<GameState>;

  generateMap(params: MapParams): void;
};

export type ActionPreview = {
  valid: boolean;

  intents: Intent[];

  errors?: ValidationError[];
};

export type ValidationError = {
  code: string;
  description: string;
}

/** Снапшот этажа для сохранения состояния при переходе между уровнями. */
export type FloorSnapshot = {
  floor: number;
  map: GameMap;
  /** Сущности этажа без игрока. При десериализации восстанавливается в Map. */
  entities: Entity[];
  explored: boolean[][];
  /** Состояние RNG на момент сохранения этажа. */
  rngState: number;
};

export type TurnPhase = {
  side: TurnSide;
  /** Корневые узлы каждого отдельного действия, выполненного в этой фазе */
  actions: ExecutionNode[];
};

export type SimulationResult = {
  success: boolean;

  stateChanged: boolean;

  /** Фазы хода в порядке выполнения */
  phases: TurnPhase[];
};

type ActionPointCostResolver = {
  getCost(action: GameAction): number;
};

export class DefaultActionPointCostResolver
    implements ActionPointCostResolver {

  getCost(action: GameAction): number {
    switch (action.type) {
      default:
        return 1;
    }
  }
}

