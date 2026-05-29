/**
 * Базовые типы слоя симуляции.
 *
 * Правила:
 * - Все типы должны быть JSON-сериализуемы (без функций, экземпляров классов, Symbols)
 * - Никаких опциональных полей, если они не опциональны в рантайме (используйте явный null)
 * - Предпочитайте плоские структуры вместо глубокой вложенности
 * - У каждой сущности есть стабильный строковый ID (используется для детерминированной сортировки)
 */

import {ENTITY_TYPE} from "@utils/constants.ts";
import type {ItemTemplate, MapParams} from "@content/schemas";
import {
  Position,
  EntityId,
  ItemInstanceId,
  TileType,
  Room,
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
} from "@simulation/core-types.ts";

// Реэкспорт базовых типов из core-types для обратной совместимости потребителей
export type {
  Position,
  EntityId,
  ItemInstanceId,
  TileType,
  Room,
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
  /** Ролленный скилл из пула снаряжения. Создаётся один раз при генерации экземпляра. */
  grantedAbility: { templateId: string; level: number } | null;
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

/** Сущность игрока. Всегда присутствует в GameState.
 *
 * Важно: поля damage, armor, maxHp являются derived-кэшем.
 * Их нельзя менять напрямую — только через recalculatePlayerBaseStats().
 */
export interface PlayerEntity extends Actor, StatusEffectHolder, TemplateIdHolder {
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
  /** Состояние ИИ в рантайме (сохраняется для памяти патруля/погони). */
  type: 'enemy';
  blocksMovement: boolean;
  /** Активные способности врага (задел на AI-скиллы). */
  abilities: RuntimeAbility[];
  /** Текущая подготовка способности (каст) или null. */
  activeCast: ActiveCast | null;
}

/** Предмет, лежащий на полу карты. */
export interface ItemEntity extends BaseEntity, TemplateIdHolder {
  type: 'item';
  blocksMovement: false;
  quantity: number;
  /** Ролленный скилл экземпляра предмета (если есть). Создаётся при спавне. */
  grantedAbility: { templateId: string; level: number } | null;
}

/** Лестница — объект перехода между этажами. */
export interface StairsEntity extends BaseEntity, TemplateIdHolder {
  type: 'stairs';
  blocksMovement: false;
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

  getState(): Readonly<GameState>;

  generateMap(params: MapParams): void;

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

  /** Возвращает все клетки, попадающие в зону действия способности. */
  getAbilityAffectedPositions(
    abilityId: string,
    selectedTargets: import("@simulation/core-types.ts").Position[],
    hoveredTarget: import("@simulation/core-types.ts").Position | null,
  ): import("@simulation/core-types.ts").Position[];

  /** Возвращает базовую информацию о способности для отображения в UI. */
  getAbilityInfo(abilityId: string): { name: string; spriteId: string | undefined; cooldown: number } | null;

  /** Возвращает итоговый урон оружия с учётом формулы и текущих характеристик игрока. */
  getWeaponDamage(player: PlayerEntity, weapon: ItemTemplate | null): number;
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

type ActionPointCostResolver = {
  getCost(action: GameAction): number;
};

export class DefaultActionPointCostResolver
    implements ActionPointCostResolver {

  getCost(action: GameAction): number {
    switch (action.type) {
      case 'USE_ABILITY':
      case 'USE_ITEM':
        // TODO: брать стоимость AP из шаблона способности / предмета
        return 1;
      case 'EQUIP':
      case 'UNEQUIP':
        return 0;
      default:
        return 1;
    }
  }
}
