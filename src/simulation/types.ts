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
  BaseStats,
  Corridor,
  CorridorSegment,
  DamageRange,
  EntityId,
  ExecutionNode,
  FactionId,
  GameAction,
  GameEvent,
  GameMap,
  GameplayTag,
  Intent,
  ItemAffix,
  ItemInstanceId,
  Position,
  Room,
  RuleTriggeredEvent,
  RuntimeAbility,
  StatModifier,
  StatModifierOp,
  StatusEffect,
  StatusEffectType,
  TileType,
  TurnSide,
  ValidationError,
  ValidationResult,
} from "@simulation/core-types.ts";
import type {AIState} from "./ai/ai-state";
import type {ActiveRule} from "./content-rules/types";

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
  DamageRange,
  ItemAffix,
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
  RuleTriggeredEvent,
  RuntimeAbility,
  GameplayTag,
  TurnSide,
  FactionId,
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
  /** Аффиксы экземпляра (до 2: 1 положительный + до 1 отрицательного).
   *  Роллятся один раз при создании экземпляра и не переролливаются. */
  affixes: ItemAffix[];
};

/** Экземпляр реликвии в коллекции игрока. Каждый стак — отдельная запись с уникальным instanceId. */
export type RelicInstance = {
  instanceId: string;
  /** Ссылается на шаблон в реестре контента (категория relics). */
  templateId: string;
};

export type Entity =
    | PlayerEntity
    | EnemyEntity
    | FloorItemContainerEntity
    | StairsEntity
    | DoorEntity
    | PropEntity
    | PointOfInterestEntity
    | TrapEntity;


export type EntityType = 'player' | 'enemy' | 'floor_item_container' | 'stairs' | 'door' | 'prop' | 'poi' | 'trap';

export interface BaseEntity {
  id: EntityId;
  type: EntityType;
  x: number;
  y: number;
  blocksMovement: boolean;
  displayName: string;
}

export interface Attacker {
  /** Derived-кэш рейнжа урона оружия (см. recalculateActorStats). */
  damage: DamageRange;
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
  factionId: FactionId;
  maxAp: number;
  ap: number;
  /** Производной кэш активных декларативных правил. */
  activeRules: ActiveRule[];
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
  /** Множитель критического урона (derived-кэш). */
  critMultiplier: number;
  /** Активные способности персонажа. */
  abilities: RuntimeAbility[];
  /** Коллекция реликвий забега (постоянные пассивные бонусы). Живёт через этажи: игрок не входит в FloorSnapshot. */
  relics: RelicInstance[];
}

/** Сущность врага на карте. */
export interface EnemyEntity extends AiActor, StatusEffectHolder, TemplateIdHolder {
  /** Активные эффекты статуса. */
  type: 'enemy';
  blocksMovement: boolean;
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
  /** Множитель критического урона (derived-кэш). */
  critMultiplier: number;
  /** Активные способности врага (innate + от экипировки). */
  abilities: RuntimeAbility[];
  /** Состояние конечного автомата ИИ (сохраняется вместе с сущностью). */
  aiState: AIState;
  /** Радиус обзора в клетках (евклидов, recursive shadowcasting). Копия из шаблона при спавне. */
  aiSightRadius: number;
}

/** Контейнер предмета, лежащего на полу карты.
 *
 *  Отделяет runtime-сущность на полу от инвентарного экземпляра предмета.
 *  При поднятии предмета контейнер удаляется, а `item` перемещается в инвентарь актора.
 */
export interface FloorItemContainerEntity extends BaseEntity, TemplateIdHolder {
  type: 'floor_item_container';
  blocksMovement: false;
  displayName: string;
  interactionKind: 'item';
  /** Готовый экземпляр предмета, хранящийся в контейнере. */
  item: InventoryItem;
}

/** Виды интерактивных объектов. Расширяется по мере добавления новых типов взаимодействий. */
export type EntityInteractionKind =
  | 'door'
  | 'stairs'
  | 'item'
  | 'lever'
  | 'prop'
  | 'poi';

/** Идентификатор конкретного взаимодействия, разрешённого `resolveInteraction`. */
export type InteractionId =
  | 'open_door'
  | 'close_door'
  | 'pickup'
  | 'descend'
  | 'ascend'
  | 'use_poi';

/** Описание разрешённого взаимодействия. */
export type ResolvedInteraction = {
  /** Идентификатор взаимодействия, используемый Presentation для подсказок и i18n. */
  interactionId: InteractionId;
  /** true — действие доступно с соседней клетки; false — нужно стоять на той же клетке. */
  usableFromAdjacent: boolean;
};

/** Лестница — объект перехода между этажами. */
export interface StairsEntity extends BaseEntity, TemplateIdHolder {
  type: 'stairs';
  blocksMovement: false;
  interactionKind: 'stairs';
  /** Направление лестницы: 'up' — к поверхности, 'down' — глубже в подземелье. */
  direction: 'up' | 'down';
}

/** Дверь — объект, который может быть открыт или закрыт. Может быть разрушена атаками. */
export interface DoorEntity extends BaseEntity, Attackable, TemplateIdHolder, StatusEffectHolder {
  type: 'door';
  blocksMovement: boolean;
  interactionKind: 'door';
  /** true — дверь открыта, проходима и не блокирует обзор. */
  isOpen: boolean;
  /** true — дверь заперта: нельзя открыть/закрыть взаимодействием. Снимается интентом UNLOCK_DOOR. */
  isLocked: boolean;
}

/** Разрушаемый объект окружения (проп). Не является актором и не ходит. */
export interface PropEntity extends BaseEntity, Attackable, TemplateIdHolder, StatusEffectHolder {
  type: 'prop';
  blocksMovement: boolean;
  blocksLOS: boolean;
  interactionKind: 'prop';
  /** Вид пропа: barrel, crate и т.д. */
  propKind: string;
}

/** Точка интереса — непроходимый неразрушаемый интерактивный объект.
 *
 *  Намеренно НЕ реализует `Attackable`: неразрушаемость выражена на уровне
 *  типов (атаковать точку интереса нельзя), а не через «бесконечное HP».
 *  Эффекты взаимодействия описываются декларативно через `ruleIds` шаблона;
 *  разовость обеспечивается процедурно — исполнитель ACTIVATE_POI тратит `charges`.
 */
export interface PointOfInterestEntity extends BaseEntity, TemplateIdHolder {
  type: 'poi';
  blocksMovement: true;
  interactionKind: 'poi';
  /** Оставшиеся заряды использования. При 0 взаимодействие недоступно. */
  charges: number;
  /**
   * Текущее предложение окна poi (id опций: реликвий, товаров и пр.).
   * Заполняется механикой окна при активации, очищается при выборе.
   * Плоская сериализуемая запись — входит в снапшот этажа автоматически.
   */
  offer?: string[];
}

/** Ловушка — проходимый объект, срабатывающий на вход сущности на её клетку.
 *
 *  Намеренно НЕ реализует `Attackable` и `interactionKind`:
 *  - разрушение атаками не поддерживается (одноразовая ловушка удаляется
 *    процедурно через интент DESTROY_OBJECT при срабатывании своего правила);
 *  - обезвреживание (взаимодействие) отложено, в этой фазе не реализуется.
 *  Эффекты срабатывания описываются декларативно через `ruleIds` шаблона
 *  (мировой слой правил `object`, триггер ENTITY_MOVED).
 */
export interface TrapEntity extends BaseEntity, TemplateIdHolder {
  type: 'trap';
  blocksMovement: false;
  /** Скрытая ловушка не рисуется и не попадает в popover, но срабатывает. */
  hidden: boolean;
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
  /** Тайловые эффекты на карте. Доступ как tileEffects[y][x]. */
  tileEffects: import('@simulation/core-types.ts').TileEffects[][];

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

  /**
   * Отдельный детерминированный RNG для игровых событий и контентных правил.
   * Не влияет на генерацию мира; позволяет воспроизводить роллы шансов из сохранения.
   */
  runtimeRng: RNGState;


  // ── Entity ID counter ──────────────────────────────────────────────
  /**
   * Монотонный счётчик для детерминированной генерации ID сущностей.
   * Увеличивается функцией `nextEntityId`. Сериализуется для детерминизма.
   */
  nextEntityCounter: number;

  // ── Run Statistics ─────────────────────────────────────────────────
  /** Статистика текущего забега. Сериализуется вместе с сохранением. */
  runStats: RunStats;

  // ── Feature Flags ──────────────────────────────────────────────────
  /** Флаги включения экспериментальных систем. Сериализуются с сохранением. */
  featureFlags: {
    /** Включена ли новая система декларативных контентных правил. */
    contentRulesEnabled: boolean;
  };
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
  /** ID шаблонов боссов, убитых в текущем забеге. */
  defeatedBossIds: string[];
};

// ─────────────────────────────────────────────
// Доменные события
// ─────────────────────────────────────────────

// GameEvent и все подтипы переехали в core-types.ts

// ─────────────────────────────────────────────
// Публичный API симуляции
// ─────────────────────────────────────────────

export type PlayerStatsSnapshot = {
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  baseStats: BaseStats;
  effectiveStats: { str: number; dex: number; int: number; vit: number };
  damage: DamageRange;
  armor: number;
  critMultiplier: number;
};

/** Фильтр сущностей для query-методов Simulation. */
export type EntityFilter = (entity: Entity) => boolean;

export type Simulation = {
  dispatch(action: GameAction): SimulationResult;

  /** Выполняет следующую системную фазу или AI-действие. */
  step(): SimulationResult;

  preview(action: GameAction): ActionPreview;

  /** true, если сейчас ход игрока (ожидается ввод). */
  isPlayerTurn(): boolean;

  /** Возвращает стоимость действия в AP. */
  getActionCost(action: GameAction): number;

  getState(): Readonly<GameState>;

  generateMap(params: MapParams): void;

  /** Перегенерировать текущий этаж (debug). */
  regenerateMap(): void;

  setDebugEnabled(enabled: boolean): void;

  /** Включает или выключает новую систему контентных правил. */
  setContentRulesEnabled(enabled: boolean): void;

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
  getAbilityInfo(abilityId: string): { spriteId: string | undefined; cooldown: number; currentCooldown: number; apCost: number | 'all'; tags: import("@simulation/core-types.ts").GameplayTag[] } | null;

  /** Возвращает режим таргетинга для расходника по шаблону, или null если таргетинг не требуется. */
  getConsumableTargetMode(templateId: string): import("@simulation/core-types.ts").TargetMode | null;

  /** Возвращает доступные клетки для выбора цели расходника по шаблону. */
  getConsumableValidTargets(templateId: string): import("@simulation/core-types.ts").Position[];

  /** Возвращает превью интентов расходника при наведении на клетку. */
  getConsumablePreview(
    templateId: string,
    hoveredTarget: import("@simulation/core-types.ts").Position | null,
  ): import("@simulation/core-types.ts").Intent[];

  /**
   * Возвращает все клетки, попадающие в зону действия расходника,
   * вычисленные от лица указанной сущности.
   */
  getConsumableAffectedPositions(
    templateId: string,
    entityId: string,
    hoveredTarget: import("@simulation/core-types.ts").Position | null,
  ): import("@simulation/core-types.ts").Position[];

  /** Возвращает итоговый рейнж урона оружия с учётом текущих модификаторов игрока. */
  getWeaponDamageRange(player: PlayerEntity): DamageRange;

  /** Возвращает распределение типов урона экипированного оружия с весами. */
  getWeaponDamageDistribution(player: PlayerEntity): Array<{ damageTag: GameplayTag; weight: number }>;

  /** Возвращает итоговый рейнж урона оружия для конкретного тега урона. */
  getWeaponDamageRangeByTag(player: PlayerEntity, tag: GameplayTag): DamageRange;

  /**
   * Считает effective рейнж урона для конкретного шаблона оружия и конкретного типа урона.
   * Формула: рейнж шаблона × вес типа × модификаторы актора (по каждому концу).
   */
  getEffectiveWeaponDamageRangeForTemplate(
    actor: StatActor,
    template: ItemTemplate,
    tag: GameplayTag,
  ): DamageRange;

  /** Проверяет, может ли игрок переместиться на указанный тайл с учётом видимости.
   *  Невидимые объекты не блокируют путь.
   *  При передаче позиционного индекса проверка по сущностям — O(1). */
  isTileWalkableForPlayer(pos: Position, index?: import('@simulation/state.ts').EntityPositionIndex): boolean;

  /** Ищет кратчайший путь для игрока от start до target. */
  findPathForPlayer(start: Position, target: Position): Position[] | null;

  /** Возвращает первую сущность на тайле, удовлетворяющую фильтру. */
  findEntityAt(pos: Position, filter?: EntityFilter, index?: import('@simulation/state.ts').EntityPositionIndex): Entity | null;

  /** Возвращает все сущности на тайле, удовлетворяющие фильтру. */
  findEntitiesAt(pos: Position, filter?: EntityFilter, index?: import('@simulation/state.ts').EntityPositionIndex): Entity[];

  /** Возвращает разрешённое взаимодействие для целевой сущности от лица актора. */
  resolveInteraction(entity: Entity, actor: Entity): ResolvedInteraction | null;

  /** Возвращает все интерактивные сущности в радиусе от актора (Chebyshev distance). */
  findInteractableEntitiesAround(actor: Entity, radius: number): Entity[];

  /** Возвращает радиус, в котором игрок может взаимодействовать с объектами. */
  getInteractionRadius(): number;
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
  /** Тайловые эффекты этажа на момент ухода с него. */
  tileEffects: import('@simulation/core-types.ts').TileEffects[][];
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

  /** true, если ход ещё не вернулся к игроку */
  hasMoreSteps: boolean;
};


