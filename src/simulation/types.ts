/**
 * Базовые типы слоя симуляции.
 *
 * Правила:
 * - Все типы должны быть JSON-сериализуемы (без функций, экземпляров классов, Symbols)
 * - Никаких опциональных полей, если они не опциональны в рантайме (используйте явный null)
 * - Предпочитайте плоские структуры вместо глубокой вложенности
 * - У каждой сущности есть стабильный строковый ID (используется для детерминированной сортировки)
 */


import type {ItemTemplate, MapParams} from "@content/schemas";
import {
  Position,
  EntityId,
  ItemInstanceId,
  TileType,
  Room,
  Corridor,
  CorridorSegment,
  GameMap,
  BaseStats,
  StatModifierOp,
  StatModifier,
  StatusEffectType,
  StatusEffect,
  ValidationResult,
  ValidationError,
  ExecutionNode,
  GameAction,
  Intent,
  GameEvent,
  RuntimeAbility,
  ActiveCast,
  DamageType,
} from "@simulation/core-types.ts";
import type { AIState } from "./ai/ai-state";

// Реэкспорт базовых типов из core-types для обратной совместимости потребителей
export type {
  Position,
  EntityId,
  ItemInstanceId,
  TileType,
  Room,
  Corridor,
  CorridorSegment,
  GameMap,
  BaseStats,
  StatModifierOp,
  StatModifier,
  StatusEffectType,
  StatusEffect,
  ValidationResult,
  ValidationError,
  ExecutionNode,
  GameAction,
  Intent,
  GameEvent,
  EntityMovedEvent,
  RuntimeAbility,
  ActiveCast,
  DamageType,
} from "@simulation/core-types.ts";
export { ExecutionBuilder } from "@simulation/core-types.ts";

// ─────────────────────────────────────────────
// Сущности
// ─────────────────────────────────────────────

/** Экземпляр предмета, находящегося в инвентаре сущности. */
export type InventoryItem = {
  instanceId: ItemInstanceId;
  /** Ссылается на шаблон в реестре контента. */
  templateId: string;
  quantity: number;
  /** Все способности предмета (фиксированные из шаблона + ролленная из abilityPool).
   *  Создаются один раз при генерации экземпляра. */
  grantedAbilities: Array<{ templateId: string; level: number }>;
};

export type Entity =
    | PlayerEntity
    | EnemyEntity
    | ItemEntity
    | StairsEntity
    | DoorEntity;


export type EntityType = 'player' | 'enemy' | 'item' | 'stairs' | 'door';

export interface BaseEntity {
  id: EntityId;
  type: EntityType;
  x: number;
  y: number;
  blocksMovement: boolean;
  displayName: string;
}

export interface Attacker {
  damage: number;
}

export interface Attackable {
  hp: number;
  maxHp: number;
  armor: number;
  isAlive: boolean;
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

/**
 * Актор с derived-статами, базовыми характеристиками и экипировкой.
 * Общий интерфейс для игрока и врагов, участвующих в формулах урона/брони.
 */
export interface StatActor {
  baseStats: BaseStats;
  statModifiers: StatModifier[];
  equippedWeaponId: string | null;
  equippedArmorId: string | null;
  equippedAmuletId: string | null;
  /** Базовое значение maxHp (для врагов — из шаблона; для игрока не используется). */
  baseMaxHp?: number;
  dodgeChance: number;
  accuracy: number;
  critChance: number;
  critMultiplier: number;
}

/** Сущность игрока. Всегда присутствует в GameState.
 *
 * Важно: поля damage, armor, maxHp являются derived-кэшем.
 * Их нельзя менять напрямую — только через recalculateActorStats().
 */
export interface PlayerEntity extends Actor, StatusEffectHolder, TemplateIdHolder, StatActor {
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
  /** ID экземпляра equipped weapon (ссылка на InventoryItem) */
  equippedWeaponInstanceId: ItemInstanceId | null;
  /** ID экземпляра equipped armor (ссылка на InventoryItem) */
  equippedArmorInstanceId: ItemInstanceId | null;
  /** ID экземпляра equipped amulet (ссылка на InventoryItem) */
  equippedAmuletInstanceId: ItemInstanceId | null;
  /** Базовые характеристики. */
  baseStats: BaseStats;
  /** Активные модификаторы (баффы, дебаффы, эффекты экипировки). */
  statModifiers: StatModifier[];
  /** Шанс уклонения (derived-кэш). */
  dodgeChance: number;
  /** Точность (derived-кэш). */
  accuracy: number;
  /** Шанс критического удара (derived-кэш). */
  critChance: number;
  /** Множитель критического урона (derived-кэш). */
  critMultiplier: number;
  /** Активные способности персонажа. */
  abilities: RuntimeAbility[];
  /** Текущая подготовка способности (каст) или null. */
  activeCast: ActiveCast | null;
}

/** Сущность врага на карте. */
export interface EnemyEntity extends AiActor, StatusEffectHolder, TemplateIdHolder {
  /** Активные эффекты статуса. */
  type: 'enemy';
  blocksMovement: boolean;
  /** Тип урона врага (fallback при отсутствии экипированного оружия). */
  damageType: DamageType;
  /** Базовые характеристики. */
  baseStats: BaseStats;
  /** Базовое значение maxHp (из шаблона; для пересчёта через vit). */
  baseMaxHp?: number;
  /** Активные модификаторы (баффы, дебаффы, эффекты экипировки). */
  statModifiers: StatModifier[];
  /** ID экипированного шаблона оружия или null. */
  equippedWeaponId: string | null;
  /** ID экипированного шаблона брони или null. */
  equippedArmorId: string | null;
  /** ID экипированного амулета или null. */
  equippedAmuletId: string | null;
  /** Шанс уклонения (derived-кэш). */
  dodgeChance: number;
  /** Точность (derived-кэш). */
  accuracy: number;
  /** Шанс критического удара (derived-кэш). */
  critChance: number;
  /** Множитель критического урона (derived-кэш). */
  critMultiplier: number;
  /** Активные способности врага (innate + от экипировки). */
  abilities: RuntimeAbility[];
  /** Текущая подготовка способности (каст) или null. */
  activeCast: ActiveCast | null;
  /** Состояние конечного автомата ИИ (сохраняется вместе с сущностью). */
  aiState: AIState;
  /** Радиус обзора в клетках (евклидов, recursive shadowcasting). Копия из шаблона при спавне. */
  aiSightRadius: number;
}

/** Предмет, лежащий на полу карты. */
export interface ItemEntity extends BaseEntity, TemplateIdHolder {
  type: 'item';
  blocksMovement: false;
  displayName: string;
  /** Готовый экземпляр предмета. Создаётся один раз при спавне. */
  item: InventoryItem;
}

/** Лестница — объект перехода между этажами. */
export interface StairsEntity extends BaseEntity, TemplateIdHolder {
  type: 'stairs';
  blocksMovement: false;
}

/** Дверь — объект, который может быть открыт или закрыт. Может быть разрушена атаками и получать статус-эффекты. */
export interface DoorEntity extends BaseEntity, Attackable, StatusEffectHolder, TemplateIdHolder {
  type: 'door';
  blocksMovement: boolean;
  /** true — дверь открыта, проходима и не блокирует обзор. */
  isOpen: boolean;
}

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

export type TurnSide = 'PLAYER' | 'ENVIRONMENT' | 'STATUS_TICK';

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

  // ── Run Statistics ─────────────────────────────────────────────────
  /** Статистика текущего забега. Сериализуется вместе с сохранением. */
  runStats: RunStats;
};

// ─────────────────────────────────────────────
// Статистика забега
// ─────────────────────────────────────────────

export type RunStats = {
  /** Timestamp начала забега (мс). */
  startTime: number;
  /** Сколько противников убито. */
  enemiesKilled: number;
  /** Сколько сундуков открыто (резерв для будущей механики). */
  chestsOpened: number;
  /** Суммарное количество подобранных предметов (в штуках). */
  itemsPickedUp: number;
};

// ─────────────────────────────────────────────
// Доменные события
// ─────────────────────────────────────────────

// GameEvent и все подтипы переехали в core-types.ts

// ─────────────────────────────────────────────
// Публичный API симуляции
// ─────────────────────────────────────────────

export type PlayerStatsSnapshot = {
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  baseStats: BaseStats;
  effectiveStats: { str: number; dex: number; int: number; vit: number };
  damage: number;
  armor: number;
  dodgeChance: number;
  accuracy: number;
  critChance: number;
  critMultiplier: number;
};

export type Simulation = {
  dispatch(action: GameAction): SimulationResult;

  preview(action: GameAction): ActionPreview;

  /** Возвращает стоимость действия в AP. */
  getActionCost(action: GameAction): number;

  getState(): Readonly<GameState>;

  generateMap(params: MapParams): void;

  /** Перегенерировать текущий этаж (debug). */
  regenerateMap(): void;

  setDebugEnabled(enabled: boolean): void;

  getPlayerStats(): Readonly<PlayerStatsSnapshot>;

  /** Возвращает режим таргетинга для способности, или null если способность не найдена. */
  getAbilityTargetMode(abilityId: string): import("@simulation/core-types.ts").TargetMode | null;

  /** Возвращает доступные клетки для выбора целей способности. */
  getAbilityValidTargets(abilityId: string): import("@simulation/core-types.ts").Position[];

  /** Возвращает превью интентов при наведении на клетку во время таргетинга. */
  getAbilityPreview(
    abilityId: string,
    selectedTargets: import("@simulation/core-types.ts").Position[],
    hoveredTarget: import("@simulation/core-types.ts").Position | null,
  ): import("@simulation/core-types.ts").Intent[];

  /**
   * Возвращает все клетки, попадающие в зону действия способности,
   * вычисленные от лица указанной сущности.
   */
  getAbilityAffectedPositions(
    abilityId: string,
    entityId: string,
    selectedTargets: import("@simulation/core-types.ts").Position[],
    hoveredTarget: import("@simulation/core-types.ts").Position | null,
  ): import("@simulation/core-types.ts").Position[];

  /** Возвращает интенты, которые исполнит способность от лица указанной сущности. */
  getAbilityIntents(
    abilityId: string,
    entityId: string,
    targets: import("@simulation/core-types.ts").Position[],
  ): import("@simulation/core-types.ts").Intent[];

  /** Возвращает базовую информацию о способности для отображения в UI. */
  getAbilityInfo(abilityId: string): { spriteId: string | undefined; cooldown: number; currentCooldown: number; apCost: number | 'all'; castTime: number } | null;

  /** Возвращает итоговый урон оружия с учётом формулы и текущих характеристик игрока. */
  getWeaponDamage(player: PlayerEntity, weapon: ItemTemplate | null): number;

  /** Возвращает записи урона оружия с типами. */
  getWeaponDamageEntries(player: PlayerEntity, weapon: ItemTemplate | null): Array<{ damage: number; damageType: import("@simulation/core-types.ts").DamageType }>;
};

export type ActionPreview = {
  valid: boolean;

  intents: Intent[];

  errors?: ValidationError[];
};

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


