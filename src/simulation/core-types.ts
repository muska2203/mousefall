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

/** Сегмент коридора: прямой отрезок между двумя точками сетки. */
export type CorridorSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** Коридор как цельная фигура. Для L-образного коридора — два сегмента. */
export type Corridor = {
  segments: CorridorSegment[];
};

export type GameMap = {
  width: number;
  height: number;
  /** Плотный двумерный массив. Доступ как tiles[y][x]. */
  tiles: TileType[][];
  /** Метаданные комнат из генератора карты (используются для размещения врагов/предметов). */
  rooms: Room[];
  /** Метаданные коридоров для debug-визуализации генерации. */
  corridors: Corridor[];
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
  stat: 'damage' | 'armor' | 'maxHp' | 'dodgeChance' | 'accuracy' | 'critChance' | 'critMultiplier' | 'str' | 'dex' | 'int' | 'vit';
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
  | 'regenerating'
  | 'parry';

/** Тип урона. */
export type DamageType =
  | 'piercing'
  | 'slashing'
  | 'blunt'
  | 'fire'
  | 'electric'
  | 'poison'
  | 'frost';

export type StatusEffect = {
  type: StatusEffectType;
  /** Оставшиеся ходы. */
  duration: number;
  /** Величина эффекта (урон в ход, лечение в ход и т.д.). */
  value: number;
  statModifiers: StatModifier[] | null;
  /** Фаза, после которой эффект должен тикать. По умолчанию 'environment'. */
  tickAfter?: 'player' | 'environment';
  /** Количество стаков (только для стакующихся статусов). */
  stacks?: number;
};

export type RuntimeAbility = {
  templateId: string;
  /** Откуда скилл получен */
  source: 'innate' | 'levelup' | 'equipment';
  /** ID экземпляра предмета, который дал этот скилл. Заполняется при source === 'equipment'. */
  sourceItemInstanceId?: string;
  /** Уровень скилла (влияет на формулу) */
  level: number;
  /** Оставшихся ходов до отката. 0 = готов. */
  currentCooldown: number;
};

/** Активный каст (подготовка способности) у сущности-актора. */
export type ActiveCast = {
  abilityId: string;
  fixedTargets: Position[];
  remainingTurns: number;
};

// ─────────────────────────────────────────────
// Валидация
// ─────────────────────────────────────────────

export type ValidationResult =
  | { ok: true }
  | { ok: false; reasonCode: string };

export type ValidationError = {
  code: string;
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
  | PrepareAbilityAction
  | PickUpAction
  | EquipAction
  | UnequipAction
  | UseItemAction
  | OpenDoorAction
  | CloseDoorAction
  | DebugAddItemAction
  | DebugSpawnEntityAction
;

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

export type PrepareAbilityAction = {
  type: 'PREPARE_ABILITY';
  entityId: EntityId;
  abilityId: string;
  targets: Position[];
};

export type PickUpAction = {
  type: 'PICKUP';
  entityId: EntityId;
};

export type EquipAction = {
  type: 'EQUIP';
  entityId: EntityId;
  itemInstanceId: ItemInstanceId;
};

export type UnequipAction = {
  type: 'UNEQUIP';
  entityId: EntityId;
  slot: 'weapon' | 'armor' | 'amulet';
};

export type UseItemAction = {
  type: 'USE_ITEM';
  entityId: EntityId;
  itemInstanceId: ItemInstanceId;
};

export type OpenDoorAction = {
  type: 'OPEN_DOOR';
  entityId: EntityId;
  targetPosition: Position;
};

export type CloseDoorAction = {
  type: 'CLOSE_DOOR';
  entityId: EntityId;
  targetPosition: Position;
};

export type DebugAddItemAction = {
  type: 'DEBUG_ADD_ITEM';
  entityId: EntityId;
  templateId: string;
};

export type DebugSpawnEntityAction = {
  type: 'DEBUG_SPAWN_ENTITY';
  entityId: EntityId;
  spawnType: 'item' | 'enemy' | 'door' | 'stairs';
  templateId: string;
  position: Position;
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
  | JumpIntent
  | PushIntent
  | DamageIntent
  | DieIntent
  | ApplyStatusIntent
  | SetMapIntent
  | SetEntitiesIntent
  | TeleportEntityIntent
  | UpdateFogIntent
  | SetCooldownIntent
  | ConsumeApIntent
  | TickStatusEffectsIntent
  | AdjustStatusStacksIntent
  | SpawnItemIntent
  | PickUpIntent
  | EquipItemIntent
  | UnequipItemIntent
  | GrantAbilityIntent
  | RevokeAbilityIntent
  | BeginCastIntent
  | PrepareAbilityIntent
  | HealIntent
  | RemoveItemIntent
  | OpenDoorIntent
  | CloseDoorIntent
  | BumpIntent
  | TriggerStairExitIntent
  | SkipStunnedTurnIntent
  | RestoreApIntent
  | TickCooldownIntent
  | TickCastIntent
  | BeginTurnIntent
  | CleanupDeadEntitiesIntent;

export type MoveIntent = { type: 'MOVE'; entityId: EntityId; dx: number; dy: number };
export type JumpIntent = { type: 'JUMP'; entityId: EntityId; dx: number; dy: number };
export type PushIntent = { type: 'PUSH'; entityId: EntityId; dx: number; dy: number; sourceEntityId: EntityId | null };
export type DamageIntent = { type: 'DAMAGE'; entityId: EntityId; sourceEntityId: EntityId | null; damage: number; damageType: DamageType };
export type DieIntent = { type: 'DIE'; entityId: EntityId; position: Position };
export type ApplyStatusIntent = { type: 'APPLY_STATUS'; entityId: EntityId; status: StatusEffect };
export type SetMapIntent = { type: 'SET_MAP'; map: GameMap; explored?: boolean[][] };
export type SetEntitiesIntent = { type: 'SET_ENTITIES'; entities: Map<EntityId, unknown> };
export type TeleportEntityIntent = { type: 'TELEPORT_ENTITY'; entityId: EntityId; x: number; y: number };
export type UpdateFogIntent = { type: 'UPDATE_FOG' };
export type SetCooldownIntent = { type: 'SET_COOLDOWN'; entityId: EntityId; abilityId: string; turns: number };
export type ConsumeApIntent = { type: 'CONSUME_AP'; entityId: EntityId; amount: number };
export type TickStatusEffectsIntent = { type: 'TICK_STATUS_EFFECTS'; entityId: EntityId; phase?: 'player' | 'environment' };
export type AdjustStatusStacksIntent = {
  type: 'ADJUST_STATUS_STACKS';
  entityId: EntityId;
  statusType: StatusEffectType;
  delta: number;
};
export type SpawnItemIntent = { type: 'SPAWN_ITEM'; templateId: string; position: Position; sourceEntityId: EntityId };
export type PickUpIntent = { type: 'PICK_UP'; entityId: EntityId; itemId: EntityId; templateId: string };
export type EquipItemIntent = { type: 'EQUIP_ITEM'; entityId: EntityId; itemInstanceId: ItemInstanceId; slot: 'weapon' | 'armor' | 'amulet' };
export type UnequipItemIntent = { type: 'UNEQUIP_ITEM'; entityId: EntityId; slot: 'weapon' | 'armor' | 'amulet' };
export type GrantAbilityIntent = { type: 'GRANT_ABILITY'; entityId: EntityId; ability: RuntimeAbility };
export type RevokeAbilityIntent = { type: 'REVOKE_ABILITY'; entityId: EntityId; sourceItemInstanceId: ItemInstanceId };
export type BeginCastIntent = { type: 'BEGIN_CAST'; entityId: EntityId; abilityId: string; targets: Position[]; turns: number };
export type PrepareAbilityIntent = { type: 'PREPARE_ABILITY'; entityId: EntityId; abilityId: string; targets: Position[] };
export type HealIntent = { type: 'HEAL'; entityId: EntityId; amount: number };
export type RemoveItemIntent = { type: 'REMOVE_ITEM'; entityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string };
export type OpenDoorIntent = { type: 'OPEN_DOOR'; entityId: EntityId; targetPosition: Position };
export type CloseDoorIntent = { type: 'CLOSE_DOOR'; entityId: EntityId; targetPosition: Position };
export type BumpIntent = { type: 'BUMP'; entityId: EntityId; position: Position; dx: number; dy: number };
export type TriggerStairExitIntent = { type: 'TRIGGER_STAIR_EXIT'; direction: 'down' | 'up' };
export type SkipStunnedTurnIntent = { type: 'SKIP_STUNNED_TURN'; entityId: EntityId };
export type RestoreApIntent = { type: 'RESTORE_AP'; entityId: EntityId };
export type TickCooldownIntent = { type: 'TICK_COOLDOWN'; entityId: EntityId; abilityId: string };
export type TickCastIntent = { type: 'TICK_CAST'; entityId: EntityId };
export type BeginTurnIntent = { type: 'BEGIN_TURN'; side: 'PLAYER' | 'ENVIRONMENT'; round?: number };
export type CleanupDeadEntitiesIntent = { type: 'CLEANUP_DEAD_ENTITIES' };

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
  | MapChangedEvent
  | EntitiesReplacedEvent
  | TurnEndedEvent
  | PlayerDiedEvent
  | PlayerLeveledUpEvent
  | FogUpdatedEvent
  | StatusAppliedEvent
  | StatusRemovedEvent
  | AbilityUsedEvent
  | AbilityPreparedEvent
  | AbilityPreparedCancelledEvent
  | ResourceConsumedEvent
  | StatusTickedEvent
  | StatusStacksAdjustedEvent
  | CooldownSetEvent
  | ItemEquippedEvent
  | ItemUnequippedEvent
  | AbilityGrantedEvent
  | AbilityRevokedEvent
  | CastStartedEvent
  | CastResolvedEvent
  | CastCancelledEvent
  | EntityHealedEvent
  | EntityBumpedEvent
  | EntityCollidedEvent
  | EntityDisplacedEvent
  | TurnBeganEvent
  | ApRestoredEvent
  | CooldownTickedEvent
  | CastTickedEvent
  | DeadEntitiesCleanedEvent;

export type ActionAppliedEvent = { type: 'ACTION_APPLIED'; action: GameAction };

export type ActionRejectedEvent = { type: 'ACTION_REJECTED'; errors: ValidationError[] };

export type EntityMovedEvent = { type: 'ENTITY_MOVED'; entityId: EntityId; from: Position; to: Position; movementType: 'walk' | 'jump' | 'dash' | 'teleport' };

export type EntityDamagedEvent = { type: 'ENTITY_DAMAGED'; targetId: EntityId; damage: number; damageType: DamageType; position: Position };

export type EntityDiedEvent = { type: 'ENTITY_DIED'; entityId: EntityId; position: Position };

export type EntityMissedEvent = { type: 'ENTITY_MISSED'; attackerId: EntityId; targetId: EntityId };

export type ItemPickedUpEvent = { type: 'ITEM_PICKED_UP'; entityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string };

export type ItemDroppedEvent = { type: 'ITEM_DROPPED'; dropperEntityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string; position: Position; from: Position };

export type ItemUsedEvent = { type: 'ITEM_USED'; entityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string };

export type DoorOpenedEvent = { type: 'DOOR_OPENED'; position: Position };

export type DoorClosedEvent = { type: 'DOOR_CLOSED'; position: Position };

export type StairExitTriggeredEvent = { type: 'STAIR_EXIT_TRIGGERED'; direction: 'down' | 'up' };

export type FloorChangedEvent = { type: 'FLOOR_CHANGED'; from: number; to: number };

export type MapChangedEvent = { type: 'MAP_CHANGED'; width: number; height: number };

export type EntitiesReplacedEvent = { type: 'ENTITIES_REPLACED'; entityIds: EntityId[] };

export type TurnEndedEvent = { type: 'TURN_ENDED'; turnNumber: number };

export type PlayerDiedEvent = { type: 'PLAYER_DIED' };

export type PlayerLeveledUpEvent = { type: 'PLAYER_LEVELED_UP'; newLevel: number };

export type FogUpdatedEvent = { type: 'FOG_UPDATED'; newlyVisible: Position[] };

export type StatusAppliedEvent = { type: 'STATUS_APPLIED'; entityId: EntityId; effect: StatusEffect };

export type StatusRemovedEvent = { type: 'STATUS_REMOVED'; entityId: EntityId; effectType: StatusEffectType };

export type StatusTickedEvent = { type: 'STATUS_TICKED'; entityId: EntityId; effectTypes: StatusEffectType[] };

export type StatusStacksAdjustedEvent = {
  type: 'STATUS_STACKS_ADJUSTED';
  entityId: EntityId;
  statusType: StatusEffectType;
  stacks: number;
};

export type AbilityUsedEvent = { type: 'ABILITY_USED'; entityId: EntityId; abilityId: string; targets: Position[]; from: Position };

export type AbilityPreparedEvent = { type: 'ABILITY_PREPARED'; entityId: EntityId; abilityId: string; targets: Position[]; from: Position };

export type AbilityPreparedCancelledEvent = { type: 'ABILITY_PREPARED_CANCELLED'; entityId: EntityId; abilityId: string; targets: Position[]; from: Position };

export type ResourceConsumedEvent = { type: 'RESOURCE_CONSUMED'; entityId: EntityId; resource: 'ap'; amount: number; remaining: number };

export type CooldownSetEvent = { type: 'COOLDOWN_SET'; entityId: EntityId; abilityId: string; turns: number };

export type ItemEquippedEvent = { type: 'ITEM_EQUIPPED'; entityId: EntityId; itemInstanceId: ItemInstanceId; slot: 'weapon' | 'armor' | 'amulet' };
export type ItemUnequippedEvent = { type: 'ITEM_UNEQUIPPED'; entityId: EntityId; itemInstanceId: ItemInstanceId; slot: 'weapon' | 'armor' | 'amulet' };
export type AbilityGrantedEvent = { type: 'ABILITY_GRANTED'; entityId: EntityId; abilityId: string; sourceItemInstanceId: ItemInstanceId };
export type AbilityRevokedEvent = { type: 'ABILITY_REVOKED'; entityId: EntityId; abilityId: string; sourceItemInstanceId: ItemInstanceId };
export type CastStartedEvent = { type: 'CAST_STARTED'; entityId: EntityId; abilityId: string; turns: number; targets: Position[]; from: Position };
export type CastResolvedEvent = { type: 'CAST_RESOLVED'; entityId: EntityId; abilityId: string; targets: Position[]; from: Position };
export type CastCancelledEvent = { type: 'CAST_CANCELLED'; entityId: EntityId; abilityId: string; from: Position };

export type EntityBumpedEvent = { type: 'ENTITY_BUMPED'; entityId: EntityId; position: Position; dx: number; dy: number };

export type EntityCollidedEvent = {
  type: 'ENTITY_COLLIDED';
  entityId: EntityId;
  targetId: EntityId | null;
  collisionType: 'wall' | 'actor' | 'blocking-object';
  sourceEntityId: EntityId | null;
  position: Position;
  dx: number;
  dy: number;
};

export type EntityDisplacedEvent = {
  type: 'ENTITY_DISPLACED';
  entityId: EntityId;
  sourceEntityId: EntityId | null;
  from: Position;
  to: Position;
  dx: number;
  dy: number;
};

export type TurnBeganEvent = {
  type: 'TURN_BEGAN';
  side: 'PLAYER' | 'ENVIRONMENT';
  round: number;
  actorId: EntityId | null;
};

export type ApRestoredEvent = {
  type: 'AP_RESTORED';
  entityId: EntityId;
  amount: number;
  remaining: number;
};

export type CooldownTickedEvent = {
  type: 'COOLDOWN_TICKED';
  entityId: EntityId;
  abilityId: string;
  remaining: number;
};

export type CastTickedEvent = {
  type: 'CAST_TICKED';
  entityId: EntityId;
  abilityId: string;
  remainingTurns: number;
};

export type EntityHealedEvent = {
  type: 'ENTITY_HEALED';
  entityId: EntityId;
  amount: number;
  newHp: number;
  position: Position;
};

export type DeadEntitiesCleanedEvent = {
  type: 'DEAD_ENTITIES_CLEANED';
  removed: { entityId: EntityId; position: Position }[];
};
