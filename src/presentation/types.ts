/**
 * Типы Presentation Layer для UI и Renderer.
 *
 * Правила:
 * - UI и renderer импортируют типы только отсюда, не из simulation/
 * - RenderInput — readonly снимок состояния + метаданные для отрисовки
 * - AnimationStep — декларативное описание одного шага анимации
 * - AnimationNode — дерево шагов, изоморфное ExecutionNode
 */

import type {
  GameAction,
  GameState,
  Intent,
  InteractionId,
  PlayerStatsSnapshot,
  RunStats,
  StatusEffect,
  TurnSide
} from '@simulation/types';
import type {DisplayPatch, DisplayState} from './displayState/types';

import type {AIMode} from '@simulation/ai/ai-state';
import type {GameplayTag as CoreGameplayTag} from '@simulation/core-types';

// Реэкспорт типов, необходимых renderer'у, чтобы UI не импортировал из simulation/
export type { TileType, TurnSide, StatusEffect, InteractionId, FactionId } from '@simulation/types';
export type { AIMode } from '@simulation/ai/ai-state';
export type { AnimationConfigKey } from '@utils/animationConfig';
export type GameplayTag = CoreGameplayTag;

/** Одна секция детальной карточки предмета. */
export type ItemDetailSection =
  | { kind: 'stat-list'; title: string; stats: Array<{ label: string; value: string | number }> }
  | { kind: 'description'; text: string };

/** Полный ViewModel для отображения детальной информации о предмете. */
export interface ItemDetailViewModel {
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'unique';
  rarityLabel: string;
  typeLabel: string;
  /** Тип предмета: weapon, armor, amulet, consumable, key, gold */
  type: string;
  icon: string;
  frameUrl: string;
  fallbackIcon?: string;
  stackCount?: number;
  /** true, если карточка отображает шаблон предмета; false — для конкретного инстанса. */
  isTemplate: boolean;
  sections: ItemDetailSection[];
  /** Все способности экземпляра предмета (фиксированные + ролленные) */
  grantedAbilities?: Array<{
    templateId: string;
    name: string;
    description: string;
    level: number;
    icon: string | null;
  }> | null;
  /** Пул скиллов, из которого роллится способность при создании экземпляра */
  abilityPool?: Array<{
    abilityId: string;
    name: string;
    description: string;
    icon: string | null;
    weight: number;
  }> | null;
  /** Пассивные свойства предмета, полученные из ruleIds шаблона. */
  properties?: Array<{
    ruleId: string;
    name: string;
    description: string;
  }> | null;
  /** Теги классификации предмета (обычно оружия). */
  tags: GameplayTag[];
  /** Локализованные метки тегов, соответствующие индексам tags. */
  tagLabels: string[];
}

export type Position = { x: number; y: number };

/** Базовые метаданные для любого шага анимации. */
type AnimationStepBase = {
  /** ID сущности, к которой привязан шаг (для цепочек анимаций одного актора).
   *  Если не задан, treeBuilder использует эвристику по полям entityId/attackerId. */
  affectedEntityId?: string;
};

/** Один конкретный шаг анимации.
 *  Длительность, blocking и easing живут в ANIMATION_CONFIG — здесь только параметры шага. */
export type AnimationStep = AnimationStepBase & (
  | {
      type: 'MOVE';
      entityId: string;
      from: Position;
      to: Position;
      /** Переопределённая длительность движения (например, для рывка). */
      duration?: number;
      /** Если false, спрайт не будет покачиваться при движении (например, рывок). */
      sway?: boolean;
    }
  | {
      type: 'JUMP';
      entityId: string;
      from: Position;
      to: Position;
    }
  | {
      type: 'TILE_SHAKE';
      center: Position;
      radius: number;
    }
  | {
      type: 'ATTACK';
      attackerId: string;
      dx: number;
      dy: number;
    }
  | {
      type: 'DAMAGE';
      targetId: string;
      amount: number;
      tags: GameplayTag[];
      position: Position;
    }
  | {
      type: 'DEATH';
      entityId: string;
    }
  | {
      type: 'FOG_UPDATE';
      newlyVisible: Position[];
    }
  | {
      type: 'PARTICLE_BURST';
      x: number;
      y: number;
      color: number;
      count: number;
    }
  | {
      type: 'UI_FLOATING_TEXT';
      text?: string;
      textKey?: string;
      x: number;
      y: number;
      styleKey: string;
    }
  | {
      type: 'ABILITY_CAST';
      entityId: string;
      abilityId: string;
      targets: Position[];
      from: Position;
    }
  | {
      type: 'PROJECTILE';
      from: Position;
      to: Position;
      /** Если true, снаряд стартует за верхней границей экрана (падение сверху). */
      fromSky?: boolean;
    }
  | {
      type: 'METEOR_FALL';
      from: Position;
      to: Position;
      /** Цвет метеорита. */
      color: number;
    }
  | {
      type: 'BEAM';
      from: Position;
      to: Position;
      /** Цвет луча. */
      color: number;
    }
  | {
      type: 'SLASH_ARC';
      from: Position;
      positions: Position[];
    }
  | {
      type: 'EXPLOSION';
      center: Position;
      radius: number;
    }
  | {
      type: 'STATUS_BURST';
      entityId: string;
      position: Position;
      statusType: string;
    }
  | {
      type: 'ITEM_DROP';
      itemId: string;
      position: Position;
      from: Position;
      templateId: string;
    }
  | {
      type: 'ITEM_THROW';
      from: Position;
      to: Position;
      templateId: string;
      spriteId: string;
    }
  | {
      type: 'BOUNCE';
      entityId: string;
      /** Клетка, где находится сущность в момент столкновения. */
      x: number;
      y: number;
      /** Направление отскока (в сторону препятствия). */
      dx: number;
      dy: number;
    }
);

/** Узел дерева анимаций.
 *  Сиблинги (дети одного родителя) выполняются параллельно.
 *  Parent → child — последовательно: дети стартуют после завершения родителя. */
export type AnimationNode = {
  step: AnimationStep;
  children: AnimationNode[];
  /** Патч DisplayState, который UI применяет после завершения шага. */
  patch?: DisplayPatch;
  /** Дополнительные патчи для переноса от невидимых дочерних событий. */
  patches?: DisplayPatch[];
};

/** Одна анимационная фаза, соответствующая стороне хода из SimulationResult.
 *  Корневые узлы фазы по умолчанию запускаются параллельно.
 *  Если sequential === true, корневые узлы выполняются строго друг за другом. */
export type AnimationPhase = {
  side: TurnSide;
  nodes: AnimationNode[];
  sequential?: boolean;
};

/** Readonly псевдоним GameState для renderer и UI. */
export type RenderState = Readonly<GameState>;

/** Предвычисленные пути к спрайтам объектов окружения. Ключ — ID сущности. */
export type ObjectSpriteMap = Map<string, string>;

/** Снапшот экипировки для отображения в UI. */
export type EquipmentSnapshot = {
  weaponId: string | null;
  armorId: string | null;
  amuletId: string | null;
  weaponInstanceId: string | null;
  armorInstanceId: string | null;
  amuletInstanceId: string | null;
  weaponDamage: number | null;
};

export type PlayerSkillViewModel = {
  abilityId: string;
  name: string;
  icon: string | null;
  cooldown: number;
  maxCooldown: number;
  isAvailable: boolean;
  /** Откуда скилл: innate / equipment */
  source: 'innate' | 'equipment';
  /** Теги классификации способности. */
  tags: GameplayTag[];
};

export type HeroStatViewModel = {
  type: 'readonly';
  icon: string;
  name: string;
  value: string;
};

export type EquipSlotViewModel = {
  label: string;
  icon?: string;
  fallback: string;
  damage?: number | null;
  rarity?: string;
  detail?: ItemDetailViewModel;
  /** Тип слота для отправки UNEQUIP action */
  slotType: 'weapon' | 'armor' | 'amulet';
  /** instanceId надетого предмета (null если слот пуст) */
  instanceId: string | null;
  /** Названия скиллов, которые даёт надетый предмет */
  grantedAbilityNames?: string[];
};

export type InventoryItemViewModel = {
  instanceId: string;
  templateId: string;
  quantity: number;
  detail: ItemDetailViewModel;
  /** Итоговый урон оружия с учётом формулы и текущих характеристик игрока (null для не-оружия) */
  damage?: number | null;
};

/** Один пункт эффекта реликвии: правило или модификатор характеристики. */
export type RelicEffectViewModel = {
  /** Устойчивый ключ пункта (ruleId или `stat_<stat>`). */
  key: string;
  /** Локализованное имя правила или характеристики. */
  name: string;
  /** Краткое описание работы (для правил может содержать тег-ссылки; для модификаторов — форматированное значение). */
  description: string;
};

/** Одна реликвия (или стак одинаковых) в панели коллекции. */
export type RelicViewModel = {
  /** Шаблон реликвии — ключ группировки стаков. */
  templateId: string;
  /** Число экземпляров этого шаблона в коллекции (стак). */
  count: number;
  /** Локализованное имя. */
  name: string;
  /** Эффекты реликвии: сначала правила, затем модификаторы характеристик. */
  effects: RelicEffectViewModel[];
  /** Атмосферный текст (опционально). */
  flavorText?: string;
  /** Путь к иконке (может отсутствовать — тогда fallback). */
  icon?: string;
  /** Emoji-заглушка, если иконки нет или не загрузилась. */
  fallback?: string;
  /** Редкость (влияет на рамку ячейки). */
  rarity: string;
  /** Путь к рамке редкости. */
  frameUrl: string;
};

export type HotbarItemKind = 'skill' | 'consumable' | 'empty';

/** Тултип для скилла в хотбаре. */
export type HotbarSkillTooltip = {
  kind: 'skill';
  name: string;
  description: string;
  icon: string | null;
  cooldown: number;
  maxCooldown: number;
  apCost: number | 'all';
  /** Теги классификации способности. */
  tags: GameplayTag[];
  /** Локализованные метки тегов, соответствующие индексам tags. */
  tagLabels: string[];
};

/** Тултип для расходника в хотбаре. */
export type HotbarConsumableTooltip = {
  kind: 'consumable';
  item: ItemDetailViewModel;
};

/** Тултип, привязанный к слоту хотбара. */
export type HotbarItemTooltip = HotbarSkillTooltip | HotbarConsumableTooltip;

/** Один слот хотбара во ViewModel для UI. */
export type HotbarItemViewModel = {
  slotIndex: number;
  kind: HotbarItemKind;
  /** Для kind === 'skill' — id способности. */
  abilityId?: string;
  /** Для kind === 'consumable' — templateId предмета. */
  templateId?: string;
  icon: string | null;
  fallback?: string;
  rarity?: string;
  /** Количество расходников в инвентаре (для consumable). */
  quantity?: number;
  /** Стоимость действия в AP. */
  apCost: number | 'all';
  /** Текущий оставшийся кулдаун (для skill). */
  cooldown?: number;
  /** Максимальный кулдаун из шаблона (для skill). */
  maxCooldown?: number;
  /** Доступен ли слот к использованию прямо сейчас. */
  isAvailable: boolean;
  /** Активирован ли слот (таргетинг или каст). */
  isActive: boolean;
  /** true, если расходник в слоте закончился, но слот ещё не перезаполнен. */
  depleted?: boolean;
  /** Тултип для отображения при наведении на слот. */
  tooltip?: HotbarItemTooltip;
};

/** Активный статус-эффект для отображения в панели эффектов. */
export type ActiveEffectViewModel = {
  icon: string;
  name: string;
  desc: string;
  turns: number;
};

export type EnemyPopoverViewModel = {
  name: string;
  sprite: string;
  flavorText: string;
  damage: number;
  hp: number;
  maxHp: number;
  skills: Array<{ name: string; icon: string | null; cooldown: number; maxCooldown: number }>;
  loot: Array<{ name: string; icon: string }>;
  /** Информация о подготовленном скилле, если враг его готовит */
  preparingAbility: { name: string; icon: string | null } | null;
};

/** Визуальное представление подготовленного AI-намерения. */
export type AIPreparedIntentViewModel = {
  entityId: string;
  abilityId: string;
  name: string;
  icon: string | null;
  fixedTargets: Position[];
  affectedPositions: Position[];
  /** Интенты выполнения скилла для отображения превью эффектов (урон, движение, статусы). */
  intents: PresentationIntent[];
};

export type StairsPopoverViewModel = {
  name: string;
  sprite: string;
  flavorText: string;
};

export type DoorPopoverViewModel = {
  name: string;
  sprite: string;
  flavorText: string;
  hp: number;
  maxHp: number;
  armor: number;
};

export type PropPopoverViewModel = {
  name: string;
  sprite: string;
  flavorText: string;
  hp: number;
  maxHp: number;
  armor: number;
  propKind: string;
};

export type PoiPopoverViewModel = {
  name: string;
  sprite: string;
  flavorText: string;
  /** Оставшиеся заряды использования точки интереса. */
  charges: number;
};

export type TrapPopoverViewModel = {
  name: string;
  sprite: string;
  flavorText: string;
};

export type FieldObjectPopoverViewModel =
  | { kind: 'enemy'; data: EnemyPopoverViewModel }
  | { kind: 'item'; data: ItemDetailViewModel }
  | { kind: 'stairs'; data: StairsPopoverViewModel }
  | { kind: 'door'; data: DoorPopoverViewModel }
  | { kind: 'prop'; data: PropPopoverViewModel }
  | { kind: 'poi'; data: PoiPopoverViewModel }
  | { kind: 'trap'; data: TrapPopoverViewModel };

/** Одна доступная опция взаимодействия на кнопку F. */
export type InteractionOption = {
  interactionId: InteractionId;
  /** Готовое действие, которое нужно отправить в Simulation. */
  action: GameAction;
  /** Клетка объекта, с которым происходит взаимодействие. */
  targetPosition: Position;
  /** Ключ перевода для короткой метки подсказки (например, "interactionHint.pickup"). */
  labelKey: string;
  /** Приоритет для автовыбора по умолчанию: меньше — выше. */
  priority: number;
};

/** Данные для отрисовки подсказки взаимодействия рядом с объектом. */
export type InteractionHintViewModel = {
  /** Клетка объекта (Presentation не знает экранных координат). */
  targetPosition: Position;
  /** Уже переведённая метка текущего действия. */
  label: string;
  /** true, если доступно более одной опции. */
  hasMultiple: boolean;
};

/** DTO-версия Intent для UI. Скрывает внутренние типы Simulation. */
export type PresentationIntent =
  | { type: 'MOVE'; entityId: string; dx: number; dy: number; from: Position; to: Position }
  | { type: 'JUMP'; entityId: string; dx: number; dy: number; from: Position; to: Position }
  | { type: 'PUSH'; entityId: string; dx: number; dy: number; from: Position; to: Position }
  | { type: 'DAMAGE'; entityId: string; damage: number; tags: GameplayTag[]; position: Position }
  | { type: 'DAMAGE_TILE'; position: Position; damage: number; tags: GameplayTag[] }
  | { type: 'HEAL'; entityId: string; amount: number; position: Position }
  | { type: 'DIE'; entityId: string; position: Position }
  | { type: 'APPLY_STATUS'; entityId: string; statusType: string; duration: number; value: number; position: Position }
  | { type: 'SET_COOLDOWN'; entityId: string; abilityId: string; turns: number }
  | { type: 'CONSUME_AP'; entityId: string; amount: number }
  | { type: 'TICK_STATUS_EFFECTS'; entityId: string };

/** Превью действия в терминах Presentation. */
export type PresentationActionPreview = {
  valid: boolean;
  intents: PresentationIntent[];
  affectedPositions: Position[];
  errors?: { code: string; description: string }[];
};

/** Маппит Simulation Intent в PresentationIntent. */
export function toPresentationIntent(intent: Intent, state: GameState): PresentationIntent | null {
  switch (intent.type) {
    case 'MOVE': {
      const entity = state.entities.get(intent.entityId);
      if (!entity) return null;
      return { type: 'MOVE', entityId: intent.entityId, dx: intent.dx, dy: intent.dy, from: { x: entity.x, y: entity.y }, to: { x: entity.x + intent.dx, y: entity.y + intent.dy } };
    }
    case 'JUMP': {
      const entity = state.entities.get(intent.entityId);
      if (!entity) return null;
      return { type: 'JUMP', entityId: intent.entityId, dx: intent.dx, dy: intent.dy, from: { x: entity.x, y: entity.y }, to: { x: entity.x + intent.dx, y: entity.y + intent.dy } };
    }
    case 'PUSH': {
      const entity = state.entities.get(intent.entityId);
      if (!entity) return null;
      return { type: 'PUSH', entityId: intent.entityId, dx: intent.dx, dy: intent.dy, from: { x: entity.x, y: entity.y }, to: { x: entity.x + intent.dx, y: entity.y + intent.dy } };
    }
    case 'DAMAGE': {
      const entity = state.entities.get(intent.entityId);
      if (!entity) return null;
      return { type: 'DAMAGE', entityId: intent.entityId, damage: intent.damage, tags: intent.tags, position: { x: entity.x, y: entity.y } };
    }
    case 'DAMAGE_TILE': {
      return { type: 'DAMAGE_TILE', position: intent.position, damage: intent.damage, tags: intent.tags };
    }
    case 'HEAL': {
      const entity = state.entities.get(intent.entityId);
      if (!entity) return null;
      return { type: 'HEAL', entityId: intent.entityId, amount: intent.amount, position: { x: entity.x, y: entity.y } };
    }
    case 'DIE': {
      const entity = state.entities.get(intent.entityId);
      if (!entity) return null;
      return { type: 'DIE', entityId: intent.entityId, position: { x: entity.x, y: entity.y } };
    }
    case 'APPLY_STATUS': {
      const entity = state.entities.get(intent.entityId);
      if (!entity) return null;
      return { type: 'APPLY_STATUS', entityId: intent.entityId, statusType: intent.status.type, duration: intent.status.duration, value: intent.status.value, position: { x: entity.x, y: entity.y } };
    }
    case 'SET_COOLDOWN':
      return { type: 'SET_COOLDOWN', entityId: intent.entityId, abilityId: intent.abilityId, turns: intent.turns };
    case 'CONSUME_AP':
      return { type: 'CONSUME_AP', entityId: intent.entityId, amount: intent.amount };
    case 'TICK_STATUS_EFFECTS':
      return { type: 'TICK_STATUS_EFFECTS', entityId: intent.entityId };
    case 'SPAWN_ITEM':
      return null;
    case 'PICK_UP':
      return null;
    case 'SPAWN_TILE_EFFECT':
      // Превью тайлового эффекта отображается через affectedPositions, а не intent.
      return null;
    default:
      return null;
  }
}


/** Вид цели подсвеченного автопути для выбора цвета оверлея. */
export type HighlightedPathTargetKind = 'none' | 'enemy' | 'interactable' | 'move';

/** Опция выбора реликвии в оконном poi (модалка алтаря). */
export type RelicChoiceOptionViewModel = {
  /** ID шаблона реликвии — передаётся в onChoose. */
  id: string;
  /** Локализованное имя. */
  name: string;
  /** Путь к иконке (может отсутствовать — тогда fallback). */
  icon?: string;
  /** Emoji-заглушка, если иконки нет или не загрузилась. */
  fallback?: string;
  /** Редкость реликвии. */
  rarity: string;
  /** Атмосферный текст (опционально). */
  flavorText?: string;
  /** Эффекты реликвии: сначала правила, затем модификаторы характеристик. */
  effects: RelicEffectViewModel[];
};

/** ViewModel открытого окна poi (модальный выбор, пока только «1 из N реликвий»). */
export type PendingWindowViewModel = {
  /** Вид окна (дискриминатор для реестра оконных компонентов в UI). */
  kind: 'relic_choice';
  /** Заголовок окна (локализованное имя poi). */
  title: string;
  /** Опции выбора — реликвии из предложения poi с готовыми ViewModel эффектов. */
  options: RelicChoiceOptionViewModel[];
};

/** Полный вход renderer'а: состояние + анимации + метаданные. */
export type RenderInput = {
  /** Readonly снимок игрового состояния от Simulation. */
  state: RenderState;
  /** Минимальная модель состояния поля, обновляемая патчами по мере анимаций. */
  displayState: DisplayState;
  /** Подсвеченный автопуть (если есть). */
  highlightedPath: Position[] | null;
  /** True, если автопуть зафиксирован (клик), false — если это только preview при hover. */
  highlightedPathCommitted: boolean;
  /** Вид цели автопути: влияет на цвет подсветки при committed-пути. */
  highlightedPathTargetKind: HighlightedPathTargetKind;
  /** Индексы тайлов автопути, на которых заканчивается ход персонажа. */
  highlightedPathTurnEndIndices: number[];
  /** Очередь анимаций в виде массива фаз. Каждая фаза привязана к стороне хода
   *  и содержит деревья анимаций; фазы между собой выполняются последовательно. */
  animations: AnimationPhase[] | null;
  /** Идентификатор текущей партии анимаций. Инкрементируется при каждом dispatch с анимациями. */
  animationBatchId: number;
  /** Фаза отрисовки: idle — можно вводить, animating — идут анимации. */
  phase: 'idle' | 'animating' | 'gameOver';
  /** Масштаб камеры (1 = 100%). */
  zoom: number;
  /** Рассчитанные характеристики игрока для отображения. */
  playerStats: PlayerStatsSnapshot;
  /** Экипировка игрока для отображения слотов. */
  equipment: EquipmentSnapshot;
  /** Оверлеи таргетинга: валидные клетки, hover, AoE, выбранные и превью интентов. */
  targetingOverlay: {
    valid: Position[];
    hover: Position | null;
    affected: Position[];
    selected: Position[];
    previewIntents: PresentationIntent[];
  } | null;
  /** Скиллы игрока для отображения в панели. */
  playerSkills: PlayerSkillViewModel[];
  /** Характеристики героя для HeroPanel. */
  heroStats: HeroStatViewModel[];
  /** Слоты экипировки для EquipmentPanel. */
  equipSlots: EquipSlotViewModel[];
  /** Предметы на полу для отображения на карте. */
  itemsOnFloor: Array<{ id: string; x: number; y: number; templateId: string }>;
  /** Предвычисленные пути к спрайтам объектов окружения (entityId → spritePath). */
  objectSprites: ObjectSpriteMap;
  /** Инвентарь игрока. */
  inventory: InventoryItemViewModel[];
  /** Коллекция реликвий игрока (сгруппирована по шаблонам, порядок — порядок получения). */
  relics: RelicViewModel[];
  /** Хотбар игрока (10 слотов: 1–9, 0). */
  hotbar: HotbarItemViewModel[];
  /** Активные статус-эффекты игрока. */
  activeEffects: ActiveEffectViewModel[];
  /**
   * Статус-эффекты всех видимых сущностей, отсортированные для отображения.
   * Presentation отвечает за порядок, UI только рисует.
   */
  statusEffectsByEntity: Map<string, readonly StatusEffect[]>;
  /**
   * AI-режим каждой сущности для иконки над объектом.
   * Для врагов включает производный режим 'prepared' (при наличии preparedAbility).
   * null означает "нет статуса" — UI показывает fallback-подложку.
   */
  aiModeByEntity: Map<string, AIMode | null>;
  /** Статистика текущего забега. */
  runStats: RunStats;
  /** Popover объекта под курсором на игровом поле (только в фазе хода игрока). */
  fieldObjectPopover: FieldObjectPopoverViewModel | null;
  /** Подсказка текущего доступного взаимодействия (F) рядом с объектом. */
  interactionHint: InteractionHintViewModel | null;
  /** Подготовленные AI-намерения, видимые игроку (телеграфы скиллов). */
  aiPreparedIntents: AIPreparedIntentViewModel[];
  /** Текущая сторона хода с точки зрения Simulation: игрок или нет.
   *  UI не должен вычислять это самостоятельно через state.turn.activeSide. */
  currentTurnSide: TurnSide;
  /** Включён ли debug-режим. Используется renderer'ом для отключения тумана войны. */
  debugEnabled: boolean;
  /** Включена ли debug-визуализация комнат и коридоров на карте. */
  mapgenDebugEnabled: boolean;
  /** Открытое окно poi (модальный выбор опции), если есть. Пока окно открыто, ввод заблокирован. */
  pendingWindow: PendingWindowViewModel | null;
};

/** Тип всплывающего уведомления. */
export type ToastKind = 'error' | 'warning' | 'info' | 'success';

/** Одно всплывающее уведомление для UI. */
export type ToastItem = {
  /** Уникальный идентификатор уведомления. */
  id: string;
  /** Визуальный тип уведомления. */
  kind: ToastKind;
  /** Короткий заголовок. */
  title: string;
  /** Подробное описание. */
  message: string;
  /** Время отображения в мс. undefined — не закрывать автоматически. */
  duration?: number;
};
