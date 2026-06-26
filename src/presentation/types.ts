/**
 * Типы Presentation Layer для UI и Renderer.
 *
 * Правила:
 * - UI и renderer импортируют типы только отсюда, не из simulation/
 * - RenderInput — readonly снимок состояния + метаданные для отрисовки
 * - AnimationStep — декларативное описание одного шага анимации
 * - AnimationNode — дерево шагов, изоморфное ExecutionNode
 */

import type { GameState, PlayerStatsSnapshot, Intent, RunStats, DamageType, TurnSide } from '@simulation/types';
import type { GameAction } from '@simulation/systems/actions/types';
import type { AnimationConfigKey } from '@utils/animationConfig';
import type { ItemDetailViewModel } from './itemDetailMapper';

// Реэкспорт типов, необходимых renderer'у, чтобы UI не импортировал из simulation/
export type { TileType, TurnSide } from '@simulation/types';
export type { AnimationConfigKey } from '@utils/animationConfig';

export type Position = { x: number; y: number };

/** Один конкретный шаг анимации.
 *  Длительность, blocking и easing живут в ANIMATION_CONFIG — здесь только параметры шага. */
export type AnimationStep =
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
      damageType: DamageType;
      position: Position;
    }
  | {
      type: 'HP_CHANGE';
      entityId: string;
      fromHp: number;
      toHp: number;
      maxHp: number;
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
      type: 'BOUNCE';
      entityId: string;
      /** Клетка, где находится сущность в момент столкновения. */
      x: number;
      y: number;
      /** Направление отскока (в сторону препятствия). */
      dx: number;
      dy: number;
    };

/** Узел дерева анимаций.
 *  Сиблинги (дети одного родителя) выполняются параллельно.
 *  Parent → child — последовательно: дети стартуют после завершения родителя. */
export type AnimationNode = {
  step: AnimationStep;
  children: AnimationNode[];
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

/** Предвычисленные пути к спрайтам дверей. Ключ — ID сущности двери. */
export type DoorSpriteMap = Map<string, string>;

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
  /** Откуда скилл: innate / levelup / equipment */
  source: 'innate' | 'levelup' | 'equipment';
  /** true, если этот скилл сейчас кастуется */
  isCasting: boolean;
  /** Оставшиеся ходов подготовки (если isCasting) */
  remainingCastTurns: number;
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
  castTime?: number;
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
  /** true, если скилл сейчас кастуется (для skill). */
  isCasting?: boolean;
  /** Оставшиеся ходов подготовки (для skill). */
  remainingCastTurns?: number;
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
  damageType: DamageType;
  damageTypeLabel: string;
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

export type FieldObjectPopoverViewModel =
  | { kind: 'enemy'; data: EnemyPopoverViewModel }
  | { kind: 'item'; data: ItemDetailViewModel }
  | { kind: 'stairs'; data: StairsPopoverViewModel }
  | { kind: 'door'; data: DoorPopoverViewModel };

/** Вид взаимодействия, доступного персонажу на клетке рядом с объектом. */
export type InteractionKind = 'pickup' | 'descend' | 'ascend' | 'openDoor' | 'closeDoor';

/** Одна доступная опция взаимодействия на кнопку F. */
export type InteractionOption = {
  kind: InteractionKind;
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
  | { type: 'DAMAGE'; entityId: string; damage: number; damageType: import('@simulation/core-types').DamageType; position: Position }
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
      return { type: 'DAMAGE', entityId: intent.entityId, damage: intent.damage, damageType: intent.damageType, position: { x: entity.x, y: entity.y } };
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
    default:
      return null;
  }
}

/** Полный вход renderer'а: состояние + анимации + метаданные. */
export type RenderInput = {
  /** Readonly снимок игрового состояния от Simulation. */
  state: RenderState;
  /** Подсвеченный автопуть (если есть). */
  highlightedPath: Position[] | null;
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
  /** Предвычисленные пути к спрайтам дверей (entityId → spritePath). */
  doorSprites: DoorSpriteMap;
  /** Инвентарь игрока. */
  inventory: InventoryItemViewModel[];
  /** Хотбар игрока (10 слотов: 1–9, 0). */
  hotbar: HotbarItemViewModel[];
  /** Активные статус-эффекты игрока. */
  activeEffects: ActiveEffectViewModel[];
  /** Статистика текущего забега. */
  runStats: RunStats;
  /** Popover объекта под курсором на игровом поле (только в фазе хода игрока). */
  fieldObjectPopover: FieldObjectPopoverViewModel | null;
  /** Подсказка текущего доступного взаимодействия (F) рядом с объектом. */
  interactionHint: InteractionHintViewModel | null;
  /** Подготовленные AI-намерения, видимые игроку (телеграфы скиллов). */
  aiPreparedIntents: AIPreparedIntentViewModel[];
  /** Включён ли debug-режим. Используется renderer'ом для отключения тумана войны. */
  debugEnabled: boolean;
  /** Включена ли debug-визуализация комнат и коридоров на карте. */
  mapgenDebugEnabled: boolean;
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
