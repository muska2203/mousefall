/**
 * Типы Presentation Layer для UI и Renderer.
 *
 * Правила:
 * - UI и renderer импортируют типы только отсюда, не из simulation/
 * - RenderInput — readonly снимок состояния + метаданные для отрисовки
 * - AnimationStep — декларативное описание одного шага анимации
 * - AnimationNode — дерево шагов, изоморфное ExecutionNode
 */

import type { GameState, PlayerStatsSnapshot, Intent, RunStats } from '@simulation/types';
import type { AnimationConfigKey } from '@utils/animationConfig';
import type { ItemDetailViewModel } from './itemDetailMapper';

// Реэкспорт типов, необходимых renderer'у, чтобы UI не импортировал из simulation/
export type { TileType } from '@simulation/types';
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
      text: string;
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
      type: 'ITEM_DROP';
      itemId: string;
      position: Position;
      from: Position;
      templateId: string;
    };

/** Узел дерева анимаций.
 *  Сиблинги (дети одного родителя) выполняются параллельно.
 *  Parent → child — последовательно: дети стартуют после завершения родителя. */
export type AnimationNode = {
  step: AnimationStep;
  children: AnimationNode[];
};

/** Readonly псевдоним GameState для renderer и UI. */
export type RenderState = Readonly<GameState>;

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
  /** Название скилла, который даёт надетый предмет */
  grantedAbilityName?: string | null;
};

export type InventoryItemViewModel = {
  instanceId: string;
  templateId: string;
  quantity: number;
  detail: ItemDetailViewModel;
  grantedAbility: { templateId: string; name: string; level: number } | null;
  /** Итоговый урон оружия с учётом формулы и текущих характеристик игрока (null для не-оружия) */
  damage?: number | null;
};

/** Активный статус-эффект для отображения в панели эффектов. */
export type ActiveEffectViewModel = {
  icon: string;
  name: string;
  desc: string;
  turns: number;
};

/** DTO-версия Intent для UI. Скрывает внутренние типы Simulation. */
export type PresentationIntent =
  | { type: 'MOVE'; entityId: string; dx: number; dy: number; from: Position; to: Position }
  | { type: 'DAMAGE'; entityId: string; damage: number; position: Position }
  | { type: 'DIE'; entityId: string; position: Position }
  | { type: 'APPLY_STATUS'; entityId: string; statusType: string; duration: number; value: number; position: Position }
  | { type: 'CHANGE_FLOOR'; direction: 'down' | 'up' }
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
    case 'DAMAGE': {
      const entity = state.entities.get(intent.entityId);
      if (!entity) return null;
      return { type: 'DAMAGE', entityId: intent.entityId, damage: intent.damage, position: { x: entity.x, y: entity.y } };
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
    case 'CHANGE_FLOOR':
      return { type: 'CHANGE_FLOOR', direction: intent.direction };
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
  /** Очередь анимаций в виде массива фаз. Каждая фаза — массив деревьев,
   *  запускаемых параллельно; фазы между собой выполняются последовательно. */
  animations: AnimationNode[][] | null;
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
  /** Инвентарь игрока. */
  inventory: InventoryItemViewModel[];
  /** Активные статус-эффекты игрока. */
  activeEffects: ActiveEffectViewModel[];
  /** Статистика текущего забега. */
  runStats: RunStats;
};
