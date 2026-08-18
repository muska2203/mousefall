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

/** Игровой тег классификации (например, attack.melee, target.aoe). */
export type GameplayTag = string;

// ─────────────────────────────────────────────
// Карта / Мир
// ─────────────────────────────────────────────

/**
 * Идентификатор террейна клетки (ключ шаблона TerrainTemplate из контентного реестра).
 * Имя типа сохранено для минимизации диффа; семантика — строковый id террейна
 * (например, 'floor', 'wall', 'sand').
 */
export type TileType = string;

export type Room = {
  /** Левый верхний угол */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * ID типа комнаты (категория roomTypes), назначенный генератором.
   * Опционально для обратной совместимости с тестовыми моками.
   */
  roomTypeId?: string;
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

/**
 * Рейнж урона оружия {min, max}.
 * Derived-кэш актора и публичные API симуляции работают с рейнжем;
 * конкретное значение роллится в момент удара (rollWeaponDamage).
 */
export type DamageRange = {
  min: number;
  max: number;
};

/**
 * Аффикс (модификатор) экземпляра экипировки.
 * Фирменные (origin 'fixed') задаются шаблоном через fixedModifiers и детерминированы;
 * случайные (origin 'rolled') роллятся один раз при создании экземпляра и далее фиксируются.
 * value = null для аффиксов без значения (scaling: 'none').
 */
export type ItemAffix = {
  /** Ссылается на шаблон в реестре контента (категория modifiers). */
  modifierId: string;
  /** Ролленное значение из рейнжа уровня шаблона предмета. */
  value: number | null;
  /** Происхождение: фирменное свойство шаблона или результат случайного ролла. */
  origin: 'fixed' | 'rolled';
};

export type StatModifier = {
  stat: 'damage' | 'armor' | 'maxHp' | 'critMultiplier' | 'str' | 'dex' | 'int' | 'vit' | 'throwRange';
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
  | 'dazed'
  | 'silenced'
  | 'regenerating'
  | 'counterattack'
  | 'bulwark'
  | 'wet'
  | 'oiled'
  | 'bleeding'
  | 'rooted';

/** Категория статуса для разрешения конфликтов между одновременно накладываемыми эффектами. */
export type StatusCategory =
  | 'elemental'
  | 'physical'
  | 'mental'
  | 'poison'
  | 'wound'
  | 'control'
  | 'generic';

/** Идентификатор фракции. */
export type FactionId = 'player' | 'allies' | 'enemies' | 'neutrals';

/** Сторона, чей ход активен в текущий момент. */
export type TurnSide = FactionId | 'status_tick' | 'round_recovery' | 'environment';

export type StatusEffect = {
  type: StatusEffectType;
  /** Оставшиеся ходы. */
  duration: number;
  /** Величина эффекта (урон в ход, лечение в ход и т.д.). */
  value: number;
  statModifiers: StatModifier[] | null;
  /** Количество стаков (только для стакующихся статусов). */
  stacks?: number;
  /** Стабильный ID экземпляра статуса. Заполняется при первом наложении. */
  instanceId?: EntityId;
};

// ─────────────────────────────────────────────
// Тайловые эффекты
// ─────────────────────────────────────────────

/**
 * Слой тайлового эффекта. На клетке может быть максимум один эффект каждого слоя:
 * новый эффект слоя заменяет старый. Слой foundation занят террейном (см. GameMap.tiles).
 */
export type TileEffectLayer = 'cover' | 'aboveGround';

/** Экземпляр статуса тайлового эффекта (например, горение на луже масла). */
export type TileEffectStatusInstance = {
  type: string;
  /** Оставшиеся ходы. */
  duration: number;
  /** Порядок отрисовки относительно родительского эффекта и других статусов. */
  renderOrder: number;
};

/** Экземпляр тайлового эффекта на конкретной клетке. */
export type TileEffectInstance = {
  type: string;
  /** Оставшиеся ходы существования эффекта. */
  duration: number;
  /** Слой эффекта. */
  layer: TileEffectLayer;
  /** Статусы материала (например, burning). */
  statusEffects: TileEffectStatusInstance[];
  /** Порядок отрисовки относительно других тайловых эффектов. */
  renderOrder: number;
};

/**
 * Набор тайловых эффектов на одной клетке: ключ — слой эффекта.
 * На клетке максимум один эффект каждого слоя; производное представление
 * «по типу эффекта» возвращает getTileEffectsAt.
 */
export type TileEffects = Partial<Record<TileEffectLayer, TileEffectInstance>>;

export type RuntimeAbility = {
  templateId: string;
  /** Откуда скилл получен */
  source: 'innate' | 'equipment';
  /** ID экземпляра предмета, который дал этот скилл. Заполняется при source === 'equipment'. */
  sourceItemInstanceId?: string;
  /** Уровень скилла (влияет на формулу) */
  level: number;
  /** Оставшихся ходов до отката. 0 = готов. */
  currentCooldown: number;
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
  | EndTurnAction
  | UseAbilityAction
  | EquipAction
  | UnequipAction
  | UseItemAction
  | InteractAction
  | ResolvePoiChoiceAction
  | DebugAddItemAction
  | DebugSpawnEntityAction
  | DebugSpawnTileEffectAction
  | DebugSetTerrainAction
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

export type EndTurnAction = {
  type: 'END_TURN';
  entityId: EntityId;
};

export type UseAbilityAction = {
  type: 'USE_ABILITY';
  entityId: EntityId;
  abilityId: string;
  targets: Position[];
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
  /** ID шаблона предмета. Упрощает анимацию после расходования предмета. */
  templateId?: string;
  /** Целевая клетка для расходников с эффектом spawn_tile_effect. */
  targetPosition?: Position;
};

export type InteractAction = {
  type: 'INTERACT';
  entityId: EntityId;
  targetId: EntityId;
};

/** Выбор опции в открытом окне poi (завершение взаимодействия, 1 AP). */
export type ResolvePoiChoiceAction = {
  type: 'RESOLVE_POI_CHOICE';
  entityId: EntityId;
  poiId: EntityId;
  optionId: string;
};

export type DebugAddItemAction = {
  type: 'DEBUG_ADD_ITEM';
  entityId: EntityId;
  templateId: string;
};

export type DebugSpawnEntityAction = {
  type: 'DEBUG_SPAWN_ENTITY';
  entityId: EntityId;
  spawnType: 'item' | 'enemy' | 'door' | 'stairs' | 'prop' | 'poi' | 'trap';
  templateId: string;
  position: Position;
};

export type DebugSpawnTileEffectAction = {
  type: 'DEBUG_SPAWN_TILE_EFFECT';
  entityId: EntityId;
  effectType: string;
  position: Position;
};

export type DebugSetTerrainAction = {
  type: 'DEBUG_SET_TERRAIN';
  entityId: EntityId;
  terrainId: TileType;
  position: Position;
};

export type TargetMode =
  | { type: 'self' }
  | { type: 'single'; range: number }
  | { type: 'multi'; range: number; count: number }
  | { type: 'area'; range: number; aoeRadius: number };

// ─────────────────────────────────────────────
// Изменения мира, заметные AI
// ─────────────────────────────────────────────

/**
 * Описание изменения мира, которое AI-стратегия может обработать.
 * Хранится в базовых типах, так как используется в Intent/GameEvent.
 */
export type WorldChange =
  | { kind: 'entity_moved'; entityId: EntityId; from: Position; to: Position }
  | { kind: 'door_opened'; position: Position }
  | { kind: 'door_closed'; position: Position };

// ─────────────────────────────────────────────
// Интенты (Intents)
// ─────────────────────────────────────────────

export type Intent =
  | MoveIntent
  | JumpIntent
  | PushIntent
  | DamageIntent
  | DamageTileIntent
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
  | GrantRelicIntent
  | HealIntent
  | RemoveItemIntent
  | OpenDoorIntent
  | CloseDoorIntent
  | LockDoorIntent
  | UnlockDoorIntent
  | FloorTransitionIntent
  | BumpIntent
  | SkipStunnedTurnIntent
  | RestoreApIntent
  | TickCooldownIntent
  | BeginTurnIntent
  | CleanupDeadEntitiesIntent
  | ApplyFogEventsIntent
  | NotifyAIIntent
  | CounterAttackIntent
  | SpawnTileEffectIntent
  | RemoveTileEffectIntent
  | TickTileEffectsIntent
  | ApplyTileEffectStatusIntent
  | RemoveTileEffectStatusIntent
  | TileExplosionIntent
  | ActivatePoiIntent
  | ResolvePoiChoiceIntent
  | DestroyObjectIntent
  | RevealObjectIntent;

export type MoveIntent = { type: 'MOVE'; entityId: EntityId; dx: number; dy: number; tags?: GameplayTag[] };
export type JumpIntent = { type: 'JUMP'; entityId: EntityId; dx: number; dy: number };
export type PushIntent = { type: 'PUSH'; entityId: EntityId; dx: number; dy: number; sourceEntityId: EntityId | null; tags?: GameplayTag[] };
export type DamageIntent = { type: 'DAMAGE'; entityId: EntityId; sourceEntityId: EntityId | null; damage: number; tags: GameplayTag[] };
export type DamageTileIntent = { type: 'DAMAGE_TILE'; position: Position; sourceEntityId: EntityId | null; damage: number; tags: GameplayTag[] };
export type DieIntent = { type: 'DIE'; entityId: EntityId; position: Position };
export type ApplyStatusIntent = { type: 'APPLY_STATUS'; entityId: EntityId; sourceEntityId: EntityId | null; status: StatusEffect; tags?: GameplayTag[] };
export type SetMapIntent = { type: 'SET_MAP'; map: GameMap; explored?: boolean[][]; tileEffects?: TileEffects[][] };
export type SetEntitiesIntent = { type: 'SET_ENTITIES'; entities: Map<EntityId, unknown> };
export type TeleportEntityIntent = {
  type: 'TELEPORT_ENTITY';
  entityId: EntityId;
  x: number;
  y: number;
  /**
   * Явное разрешение телепортировать обездвиженную (rooted) сущность.
   * Используется системными телепортами (переход между этажами); игровые
   * телепорты по умолчанию блокируются rooted (концепт этажа 1, §2).
   */
  ignoreRooted?: boolean;
};
export type UpdateFogIntent = { type: 'UPDATE_FOG' };
export type SetCooldownIntent = { type: 'SET_COOLDOWN'; entityId: EntityId; abilityId: string; turns: number };
export type ConsumeApIntent = { type: 'CONSUME_AP'; entityId: EntityId; amount: number };
export type TickStatusEffectsIntent = { type: 'TICK_STATUS_EFFECTS'; entityId: EntityId; phase: TurnSide };
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
export type GrantRelicIntent = { type: 'GRANT_RELIC'; entityId: EntityId; templateId: string };
export type HealIntent = { type: 'HEAL'; entityId: EntityId; amount: number; tags?: GameplayTag[] };
export type RemoveItemIntent = { type: 'REMOVE_ITEM'; entityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string };
export type OpenDoorIntent = { type: 'OPEN_DOOR'; entityId: EntityId; targetPosition: Position };
export type CloseDoorIntent = { type: 'CLOSE_DOOR'; entityId: EntityId; targetPosition: Position };
export type LockDoorIntent = { type: 'LOCK_DOOR'; entityId: EntityId; targetPosition: Position };
export type UnlockDoorIntent = { type: 'UNLOCK_DOOR'; entityId: EntityId; targetPosition: Position };
export type FloorTransitionIntent = { type: 'FLOOR_TRANSITION'; entityId: EntityId; direction: 'down' | 'up' };
export type BumpIntent = { type: 'BUMP'; entityId: EntityId; position: Position; dx: number; dy: number };
export type ApplyFogEventsIntent = { type: 'APPLY_FOG_EVENTS'; events: FogUpdatedEvent[] };
export type SkipStunnedTurnIntent = { type: 'SKIP_STUNNED_TURN'; entityId: EntityId };
export type RestoreApIntent = { type: 'RESTORE_AP'; entityId: EntityId };
export type TickCooldownIntent = { type: 'TICK_COOLDOWN'; entityId: EntityId; abilityId: string };
export type BeginTurnIntent = { type: 'BEGIN_TURN'; side: TurnSide; round?: number };
export type CleanupDeadEntitiesIntent = { type: 'CLEANUP_DEAD_ENTITIES' };
export type NotifyAIIntent = { type: 'NOTIFY_AI'; entityId: EntityId; change: WorldChange };
export type CounterAttackIntent = { type: 'COUNTER_ATTACK'; counterAttackerId: EntityId; targetId: EntityId; dx?: number; dy?: number };
export type SpawnTileEffectIntent = {
  type: 'SPAWN_TILE_EFFECT';
  effectType: string;
  position: Position;
  duration?: number;
  /** Опциональный статус, который сразу накладывается на созданный тайловый эффект. */
  statusType?: string;
  /** Длительность начального статуса; если не указана — берётся из шаблона статуса. */
  statusDuration?: number;
};
export type RemoveTileEffectIntent = { type: 'REMOVE_TILE_EFFECT'; effectType: string; position: Position };
export type TickTileEffectsIntent = { type: 'TICK_TILE_EFFECTS' };
export type ApplyTileEffectStatusIntent = {
  type: 'APPLY_TILE_EFFECT_STATUS';
  effectType: string;
  statusType: string;
  position: Position;
  duration?: number;
  /** Сущность-источник наложения статуса; для мировых правил берётся из контекста события. */
  sourceEntityId?: EntityId | null;
};
export type RemoveTileEffectStatusIntent = {
  type: 'REMOVE_TILE_EFFECT_STATUS';
  effectType: string;
  statusType: string;
  position: Position;
};
export type TileExplosionIntent = {
  type: 'TILE_EXPLOSION';
  position: Position;
  sourceEntityId: EntityId | null;
  damage: number;
  radius: number;
  tags: GameplayTag[];
};
export type ActivatePoiIntent = { type: 'ACTIVATE_POI'; entityId: EntityId; targetPosition: Position };
export type ResolvePoiChoiceIntent = { type: 'RESOLVE_POI_CHOICE'; entityId: EntityId; poiId: EntityId; optionId: string };
export type DestroyObjectIntent = { type: 'DESTROY_OBJECT'; entityId: EntityId };
export type RevealObjectIntent = { type: 'REVEAL_OBJECT'; entityId: EntityId };

// ─────────────────────────────────────────────
// Доменные события (Events)
// ─────────────────────────────────────────────

/** Базовые метаданные любого игрового события. */
type GameEventBase = {
  /** True, если событие происходит на игровом поле и подлежит FOV-фильтрации. */
  isFieldEvent: boolean;
};

export type GameEvent =
  | ActionAppliedEvent
  | ActionRejectedEvent
  | EntityMovedEvent
  | EntityDamagedEvent
  | TileDamagedEvent
  | EntityDiedEvent
  | ItemPickedUpEvent
  | ItemDroppedEvent
  | ItemUsedEvent
  | DoorOpenedEvent
  | DoorClosedEvent
  | DoorLockedEvent
  | DoorUnlockedEvent
  | FloorChangedEvent
  | MapChangedEvent
  | EntitiesReplacedEvent
  | TurnEndedEvent
  | PlayerDiedEvent
  | FogUpdatedEvent
  | StatusAppliedEvent
  | StatusRemovedEvent
  | StatusBlockedEvent
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
  | RelicGrantedEvent
  | EntityHealedEvent
  | EntityBumpedEvent
  | EntityCollidedEvent
  | EntityDisplacedEvent
  | TurnBeganEvent
  | ApRestoredEvent
  | CooldownTickedEvent
  | DeadEntitiesCleanedEvent
  | AiNotifiedEvent
  | CounterAttackAppliedEvent
  | RuleTriggeredEvent
  | TileEffectChangedEvent
  | TileEffectRemovedEvent
  | TileEffectStatusAppliedEvent
  | TileEffectStatusRemovedEvent
  | TileEffectStatusTickedEvent
  | TileEffectTickedEvent
  | TileExplodedEvent
  | PoiUsedEvent
  | ObjectDestroyedEvent
  | ObjectRevealedEvent;

export type ActionAppliedEvent = GameEventBase & { type: 'ACTION_APPLIED'; action: GameAction };

export type ActionRejectedEvent = GameEventBase & { type: 'ACTION_REJECTED'; errors: ValidationError[] };

export type EntityMovedEvent = GameEventBase & { type: 'ENTITY_MOVED'; entityId: EntityId; from: Position; to: Position; movementType: 'walk' | 'jump' | 'dash' | 'teleport' };

export type EntityDamagedEvent = GameEventBase & { type: 'ENTITY_DAMAGED'; targetId: EntityId; sourceEntityId: EntityId | null; damage: number; position: Position; tags: GameplayTag[] };

export type TileDamagedEvent = GameEventBase & { type: 'TILE_DAMAGED'; position: Position; sourceEntityId: EntityId | null; damage: number; tags: GameplayTag[] };

export type EntityDiedEvent = GameEventBase & { type: 'ENTITY_DIED'; entityId: EntityId; position: Position };

export type ItemPickedUpEvent = GameEventBase & { type: 'ITEM_PICKED_UP'; entityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string };

export type ItemDroppedEvent = GameEventBase & {
  type: 'ITEM_DROPPED';
  dropperEntityId: EntityId;
  /** ID инвентарного экземпляра предмета (консистентно с ITEM_PICKED_UP). */
  itemInstanceId: ItemInstanceId;
  /** ID сущности-контейнера на полу (используется анимацией и renderer'ом). */
  containerId: EntityId;
  templateId: string;
  position: Position;
  from: Position;
};

export type ItemUsedEvent = GameEventBase & { type: 'ITEM_USED'; entityId: EntityId; itemInstanceId: ItemInstanceId; templateId: string };

export type DoorOpenedEvent = GameEventBase & { type: 'DOOR_OPENED'; position: Position };

export type DoorClosedEvent = GameEventBase & { type: 'DOOR_CLOSED'; position: Position };

export type DoorLockedEvent = GameEventBase & { type: 'DOOR_LOCKED'; position: Position };

export type DoorUnlockedEvent = GameEventBase & { type: 'DOOR_UNLOCKED'; position: Position };

export type FloorChangedEvent = GameEventBase & {
  type: 'FLOOR_CHANGED';
  from: number;
  to: number;
  plan: FloorTransitionPlan;
};

/** План перехода между этажами. Хранится в событии FLOOR_CHANGED для последующих реакций. */
export type FloorTransitionPlan = {
  /** Направление перехода. */
  direction: 'down' | 'up';
  /** Этаж, с которого уходим. */
  from: number;
  /** Этаж, на который приходим. */
  to: number;
  /** Карта целевого этажа. */
  map: GameMap;
  /** Сущности целевого этажа (включая игрока). */
  entities: Map<EntityId, unknown>;
  /** Позиция игрока после перехода. */
  playerPosition: Position;
  /** Состояние хода после перехода. */
  turn: { activeSide: TurnSide; round: number };
  /** Сетка исследованных клеток целевого этажа. */
  explored: boolean[][];
  /** Тайловые эффекты целевого этажа (восстановленные из снапшота или пустая сетка). */
  tileEffects: TileEffects[][];
  /** События FOV, полученные после пересчёта на целевом состоянии. */
  fovEvents: GameEvent[];
};

export type MapChangedEvent = GameEventBase & { type: 'MAP_CHANGED'; width: number; height: number };

export type EntitiesReplacedEvent = GameEventBase & { type: 'ENTITIES_REPLACED'; entityIds: EntityId[] };

export type TurnEndedEvent = GameEventBase & { type: 'TURN_ENDED'; turnNumber: number };

export type PlayerDiedEvent = GameEventBase & { type: 'PLAYER_DIED' };

export type FogUpdatedEvent = GameEventBase & { type: 'FOG_UPDATED'; newlyVisible: Position[] };

export type StatusAppliedEvent = GameEventBase & { type: 'STATUS_APPLIED'; entityId: EntityId; sourceEntityId: EntityId | null; effect: StatusEffect };

export type StatusRemovedEvent = GameEventBase & { type: 'STATUS_REMOVED'; entityId: EntityId; effectType: StatusEffectType };

export type StatusBlockedEvent = GameEventBase & {
  type: 'STATUS_BLOCKED';
  entityId: EntityId;
  sourceEntityId: EntityId | null;
  statusType: StatusEffectType;
  blockedBy: StatusEffectType;
};

export type StatusTickedEvent = GameEventBase & { type: 'STATUS_TICKED'; entityId: EntityId; effectTypes: StatusEffectType[]; tags: GameplayTag[] };

export type StatusStacksAdjustedEvent = GameEventBase & {
  type: 'STATUS_STACKS_ADJUSTED';
  entityId: EntityId;
  statusType: StatusEffectType;
  stacks: number;
};

export type AbilityUsedEvent = GameEventBase & { type: 'ABILITY_USED'; entityId: EntityId; abilityId: string; targets: Position[]; from: Position };

export type AbilityPreparedEvent = GameEventBase & { type: 'ABILITY_PREPARED'; entityId: EntityId; abilityId: string; targets: Position[]; from: Position };

export type AbilityPreparedCancelledEvent = GameEventBase & { type: 'ABILITY_PREPARED_CANCELLED'; entityId: EntityId; abilityId: string; targets: Position[]; from: Position };

export type ResourceConsumedEvent = GameEventBase & { type: 'RESOURCE_CONSUMED'; entityId: EntityId; resource: 'ap'; amount: number; remaining: number };

export type CooldownSetEvent = GameEventBase & { type: 'COOLDOWN_SET'; entityId: EntityId; abilityId: string; turns: number };

export type ItemEquippedEvent = GameEventBase & { type: 'ITEM_EQUIPPED'; entityId: EntityId; itemInstanceId: ItemInstanceId; slot: 'weapon' | 'armor' | 'amulet' };
export type ItemUnequippedEvent = GameEventBase & { type: 'ITEM_UNEQUIPPED'; entityId: EntityId; itemInstanceId: ItemInstanceId; slot: 'weapon' | 'armor' | 'amulet' };
export type AbilityGrantedEvent = GameEventBase & { type: 'ABILITY_GRANTED'; entityId: EntityId; abilityId: string; sourceItemInstanceId: ItemInstanceId };
export type AbilityRevokedEvent = GameEventBase & { type: 'ABILITY_REVOKED'; entityId: EntityId; abilityId: string; sourceItemInstanceId: ItemInstanceId };
export type RelicGrantedEvent = GameEventBase & { type: 'RELIC_GRANTED'; entityId: EntityId; relicId: string; instanceId: string };
export type EntityBumpedEvent = GameEventBase & { type: 'ENTITY_BUMPED'; entityId: EntityId; position: Position; dx: number; dy: number };

export type EntityCollidedEvent = GameEventBase & {
  type: 'ENTITY_COLLIDED';
  entityId: EntityId;
  targetId: EntityId | null;
  collisionType: 'wall' | 'actor' | 'blocking-object';
  sourceEntityId: EntityId | null;
  position: Position;
  dx: number;
  dy: number;
  tags: GameplayTag[];
};

export type EntityDisplacedEvent = GameEventBase & {
  type: 'ENTITY_DISPLACED';
  entityId: EntityId;
  sourceEntityId: EntityId | null;
  from: Position;
  to: Position;
  dx: number;
  dy: number;
};

export type TurnBeganEvent = GameEventBase & {
  type: 'TURN_BEGAN';
  side: TurnSide;
  round: number;
  actorId: EntityId | null;
};

export type ApRestoredEvent = GameEventBase & {
  type: 'AP_RESTORED';
  entityId: EntityId;
  amount: number;
  remaining: number;
};

export type CooldownTickedEvent = GameEventBase & {
  type: 'COOLDOWN_TICKED';
  entityId: EntityId;
  abilityId: string;
  remaining: number;
};

export type EntityHealedEvent = GameEventBase & {
  type: 'ENTITY_HEALED';
  entityId: EntityId;
  amount: number;
  newHp: number;
  position: Position;
};

export type DeadEntitiesCleanedEvent = GameEventBase & {
  type: 'DEAD_ENTITIES_CLEANED';
  removed: { entityId: EntityId; position: Position }[];
};

export type AiNotifiedEvent = GameEventBase & {
  type: 'AI_NOTIFIED';
  entityId: EntityId;
  change: WorldChange;
};

export type CounterAttackAppliedEvent = GameEventBase & {
  type: 'COUNTER_ATTACK_APPLIED';
  attackerId: EntityId;
  targetId: EntityId;
  dx: number;
  dy: number;
  /** Урон, рассчитанный исполнителем интента контратаки. */
  damage: number;
  /** Теги урона контратаки (основной тег + теги оружия + reaction.counter). */
  tags: GameplayTag[];
};

/**
 * Observability-событие: контентное правило сработало и породило интенты.
 * Не влияет на игровую логику, нужно только для debug-визуализации цепочек правил.
 */
export type RuleTriggeredEvent = GameEventBase & {
  type: 'RULE_TRIGGERED';
  ruleId: string;
  layer: 'source' | 'target' | 'world' | 'radius';
  ownerEntityId: EntityId | null;
  triggerEventType: string;
  triggerTags: GameplayTag[];
  intents: Intent[];
  conditionMatched: boolean;
};

export type TileEffectChangedEvent = GameEventBase & {
  type: 'TILE_EFFECT_CHANGED';
  effectType: string;
  position: Position;
  /** true, если эффект только что создан; false, если обновлён (например, продлён). */
  isNew: boolean;
};

export type TileEffectRemovedEvent = GameEventBase & {
  type: 'TILE_EFFECT_REMOVED';
  effectType: string;
  position: Position;
};

export type TileEffectStatusAppliedEvent = GameEventBase & {
  type: 'TILE_EFFECT_STATUS_APPLIED';
  effectType: string;
  statusType: string;
  position: Position;
  duration: number;
  /** Сущность-источник наложения статуса; null для мировых правил. */
  sourceEntityId: EntityId | null;
  /** true, если статус только что наложен; false, если обновлён (например, продлён). */
  isNew: boolean;
};

export type TileEffectStatusRemovedEvent = GameEventBase & {
  type: 'TILE_EFFECT_STATUS_REMOVED';
  effectType: string;
  statusType: string;
  position: Position;
};

export type TileEffectStatusTickedEvent = GameEventBase & {
  type: 'TILE_EFFECT_STATUS_TICKED';
  effectType: string;
  statusType: string;
  position: Position;
};

export type TileEffectTickedEvent = GameEventBase & {
  type: 'TILE_EFFECT_TICKED';
  effectType: string;
  position: Position;
};

export type TileExplodedEvent = GameEventBase & {
  type: 'TILE_EXPLODED';
  position: Position;
  sourceEntityId: EntityId | null;
  damage: number;
  radius: number;
  tags: GameplayTag[];
};

/** Событие активации точки интереса (алтарь и т.п.). */
export type PoiUsedEvent = GameEventBase & {
  type: 'POI_USED';
  /** Сущность, активировавшая точку интереса. */
  entityId: EntityId;
  /** ID сущности точки интереса. */
  poiId: EntityId;
  /** ID шаблона точки интереса. */
  poiType: string;
  position: Position;
  /** Заряды, оставшиеся после этой активации. */
  remainingCharges: number;
};

/** Событие уничтожения объекта на поле (например, одноразовой ловушки после срабатывания). */
export type ObjectDestroyedEvent = GameEventBase & {
  type: 'OBJECT_DESTROYED';
  /** ID удалённой сущности. */
  entityId: EntityId;
  /** ID шаблона сущности (если был). */
  objectType?: string;
  position: Position;
};

/** Событие раскрытия скрытого объекта (постоянная ловушка после срабатывания). */
export type ObjectRevealedEvent = GameEventBase & {
  type: 'OBJECT_REVEALED';
  /** ID раскрытой сущности. */
  entityId: EntityId;
  /** ID шаблона сущности (если был). */
  objectType?: string;
  position: Position;
};
