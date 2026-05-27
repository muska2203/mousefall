/**
 * Базовые типы слоя симуляции, не зависящие от GameState.
 *
 * Правила:
 * - Этот файл НЕ ДОЛЖЕН импортировать из @simulation/types.ts или из модулей systems/
 * - Все типы должны быть JSON-сериализуемы (без функций, экземпляров классов, Symbols)
 * - Никаких опциональных полей, если они не опциональны в рантайме (используйте явный null)
 * - Предпочитайте плоские структуры вместо глубокой вложенности
 */

// ─────────────────────────────────────────────
// Примитивы
// ─────────────────────────────────────────────

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
// Базовые характеристики и модификаторы
// ─────────────────────────────────────────────

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
  statModifiers: StatModifier[] | null;
};

// ─────────────────────────────────────────────
// Валидация
// ─────────────────────────────────────────────

export type ValidationResult =
  | { ok: true }
  | { ok: false; reasonCode: string; reasonDescription: string };

export type ValidationError = {
  code: string;
  description: string;
};

// ─────────────────────────────────────────────
// Дерево выполнения (Execution)
// ─────────────────────────────────────────────

export type ExecutionNode = {
  event: GameEvent;
  parent: ExecutionNode | null;
  children: ExecutionNode[];
};

export class ExecutionBuilder {
  root: ExecutionNode;
  constructor(event: GameEvent) {
    this.root = {
      event,
      parent: null,
      children: [],
    };
  }

  addChild(
    parent: ExecutionNode,
    event: GameEvent,
  ): ExecutionNode {
    const node = {
      event,
      parent: parent,
      children: [],
    };

    parent.children.push(node);

    return node;
  }
}

// ─────────────────────────────────────────────
// Действия (Actions)
// ─────────────────────────────────────────────

export type GameAction =
  | MoveAction
  | AttackAction
  | WaitAction
  | DescendAction
  | AscendAction
  | UseAbilityAction
  | PickUpAction;

export type MoveAction = {
  type: 'MOVE';
  entityId: EntityId;
  dx: number;
  dy: number;
};

export type AttackAction = {
  type: 'ATTACK';
  entityId: EntityId;
  dx: number;
  dy: number;
};

export type WaitAction = {
  type: 'WAIT';
  entityId: EntityId;
};

export type DescendAction = {
  type: 'DESCEND';
  entityId: EntityId;
};

export type AscendAction = {
  type: 'ASCEND';
  entityId: EntityId;
};

export type UseAbilityAction = {
  type: 'USE_ABILITY';
  entityId: EntityId;
  abilityId: string;
  targets: Position[];
};

export type PickUpAction = {
  type: 'PICKUP';
  entityId: EntityId;
};

export type TargetMode =
  | { type: 'self' }
  | { type: 'single'; range: number }
  | { type: 'multi'; range: number; count: number }
  | { type: 'area'; range: number; aoeRadius: number };

// ─────────────────────────────────────────────
// Интенты (Intents)
// ─────────────────────────────────────────────

export type Intent =
  | MoveIntent
  | DamageIntent
  | DieIntent
  | ApplyStatusIntent
  | ChangeFloorIntent
  | ConsumeMpIntent
  | SetCooldownIntent
  | ConsumeApIntent
  | TickStatusEffectsIntent
  | SpawnItemIntent
  | PickUpIntent;

export type MoveIntent = { type: 'MOVE'; entityId: EntityId; dx: number; dy: number };
export type DamageIntent = { type: 'DAMAGE'; entityId: EntityId; damage: number };
export type DieIntent = { type: 'DIE'; entityId: EntityId; position: Position };
export type ApplyStatusIntent = { type: 'APPLY_STATUS'; entityId: EntityId; status: StatusEffect };
export type ChangeFloorIntent = { type: 'CHANGE_FLOOR'; direction: 'down' | 'up' };
export type ConsumeMpIntent = { type: 'CONSUME_MP'; entityId: EntityId; amount: number };
export type SetCooldownIntent = { type: 'SET_COOLDOWN'; entityId: EntityId; abilityId: string; turns: number };
export type ConsumeApIntent = { type: 'CONSUME_AP'; entityId: EntityId; amount: number };
export type TickStatusEffectsIntent = { type: 'TICK_STATUS_EFFECTS'; entityId: EntityId };
export type SpawnItemIntent = { type: 'SPAWN_ITEM'; templateId: string; position: Position; sourceEntityId: EntityId };
export type PickUpIntent = { type: 'PICK_UP'; entityId: EntityId; itemId: EntityId; templateId: string };

// ─────────────────────────────────────────────
// Доменные события (Events)
// ─────────────────────────────────────────────

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
  | AbilityUsedEvent
  | ResourceConsumedEvent
  | StatusTickedEvent
  | CooldownSetEvent;

export type ActionAppliedEvent = { type: 'ACTION_APPLIED'; action: GameAction };

export type ActionRejectedEvent = { type: 'ACTION_REJECTED'; errors: ValidationError[] };

export type EntityMovedEvent = { type: 'ENTITY_MOVED'; entityId: EntityId; from: Position; to: Position };

export type EntityDamagedEvent = { type: 'ENTITY_DAMAGED'; targetId: EntityId; damage: number; position: Position };

export type EntityDiedEvent = { type: 'ENTITY_DIED'; entityId: EntityId; position: Position };

export type EntityMissedEvent = { type: 'ENTITY_MISSED'; attackerId: EntityId; targetId: EntityId };

export type ItemPickedUpEvent = { type: 'ITEM_PICKED_UP'; entityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string };

export type ItemDroppedEvent = { type: 'ITEM_DROPPED'; dropperEntityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string; position: Position; from: Position };

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

export type StatusTickedEvent = { type: 'STATUS_TICKED'; entityId: EntityId };

export type AbilityUsedEvent = { type: 'ABILITY_USED'; entityId: EntityId; abilityId: string; targets: Position[]; from: Position };

export type ResourceConsumedEvent = { type: 'RESOURCE_CONSUMED'; entityId: EntityId; resource: 'mp' | 'ap'; amount: number; remaining: number };

export type CooldownSetEvent = { type: 'COOLDOWN_SET'; entityId: EntityId; abilityId: string; turns: number };
