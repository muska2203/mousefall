/**
 * Типы ядра DisplayState.
 *
 * DisplayState — минимальная модель игрового мира, из которой UI рисует поле.
 * Она строится из GameState и обновляется патчами, порождёнными событиями Simulation.
 */

import type {EntityType, GameEvent, GamePhase, Position, StatusEffect, TileType, TurnSide,} from '@simulation/types';
import type {StatusEffectType} from '@simulation/core-types.ts';
import type {AnimationNode} from '@presentation/types';

/** Сущность, отображаемая на поле. */
export type DisplayEntity = {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  templateId: string;
  hp?: number;
  maxHp?: number;
  isAlive?: boolean;
  statusEffects?: StatusEffect[];
  /** Для дверей: открыта или закрыта. */
  isOpen?: boolean;
  /** Для игрока: текущий уровень. */
  level?: number;
};

/** Один тайл, отображаемый на поле. */
export type DisplayTile = {
  type: TileType;
  /** Опциональный идентификатор тайлового эффекта (например, лужа крови). */
  tileEffect?: string;
};

/** Карта, видимость и исследованность с точки зрения игрока. */
export type DisplayMap = {
  width: number;
  height: number;
  tiles: DisplayTile[][];
  visible: boolean[][];
  explored: boolean[][];
};

/** Метаданные текущего хода/этажа. */
export type DisplayMeta = {
  floor: number;
  round: number;
  turnSide: TurnSide;
  phase: GamePhase;
};

/** Полное состояние для отрисовки. */
export type DisplayState = {
  map: DisplayMap;
  entities: Map<string, DisplayEntity>;
  player: DisplayEntity;
  meta: DisplayMeta;
};

// ─────────────────────────────────────────────
// Патчи изменения DisplayState
// ─────────────────────────────────────────────

/** Патч без изменения визуального состояния. */
export type NoOpPatch = {
  type: 'NO_OP';
};

export type EntityMovedPatch = {
  type: 'ENTITY_MOVED';
  entityId: string;
  from: Position;
  to: Position;
};

export type EntityDamagedPatch = {
  type: 'ENTITY_DAMAGED';
  entityId: string;
  damage: number;
};

export type EntityHealedPatch = {
  type: 'ENTITY_HEALED';
  entityId: string;
  amount: number;
  newHp: number;
};

export type EntityDiedPatch = {
  type: 'ENTITY_DIED';
  entityId: string;
};

export type EntityDisplacedPatch = {
  type: 'ENTITY_DISPLACED';
  entityId: string;
  from: Position;
  to: Position;
};

export type StatusAppliedPatch = {
  type: 'STATUS_APPLIED';
  entityId: string;
  effect: StatusEffect;
};

export type StatusRemovedPatch = {
  type: 'STATUS_REMOVED';
  entityId: string;
  effectType: StatusEffectType;
};

export type FogUpdatedPatch = {
  type: 'FOG_UPDATED';
  /** Полный снимок видимых клеток после пересчёта FOV. */
  visible: Position[];
  /** Полный снимок исследованных клеток после пересчёта FOV. */
  explored: Position[];
};


export type DoorOpenedPatch = {
  type: 'DOOR_OPENED';
  position: Position;
};

export type DoorClosedPatch = {
  type: 'DOOR_CLOSED';
  position: Position;
};

export type ItemDroppedPatch = {
  type: 'ITEM_DROPPED';
  container: DisplayEntity;
};

export type DeadEntitiesCleanedPatch = {
  type: 'DEAD_ENTITIES_CLEANED';
  removed: { entityId: string; position: Position }[];
};

export type FloorChangedPatch = {
  type: 'FLOOR_CHANGED';
  floor: number;
};

export type PlayerDiedPatch = {
  type: 'PLAYER_DIED';
};

export type PlayerLeveledUpPatch = {
  type: 'PLAYER_LEVELED_UP';
  level: number;
};

export type TurnBeganPatch = {
  type: 'TURN_BEGAN';
  turnSide: TurnSide;
  round: number;
};

export type TileEffectChangedPatch = {
  type: 'TILE_EFFECT_CHANGED';
  effectType: string;
  position: Position;
};

export type TileEffectRemovedPatch = {
  type: 'TILE_EFFECT_REMOVED';
  effectType: string;
  position: Position;
};

export type ItemPickedUpPatch = {
  type: 'ITEM_PICKED_UP';
  entityId: string;
  itemInstanceId: string;
};

/** Union всех патчей, которые могут изменить DisplayState. */
export type DisplayPatch =
  | NoOpPatch
  | EntityMovedPatch
  | EntityDamagedPatch
  | EntityHealedPatch
  | EntityDiedPatch
  | EntityDisplacedPatch
  | StatusAppliedPatch
  | StatusRemovedPatch
  | FogUpdatedPatch
  | DoorOpenedPatch
  | DoorClosedPatch
  | ItemDroppedPatch
  | DeadEntitiesCleanedPatch
  | FloorChangedPatch
  | PlayerDiedPatch
  | PlayerLeveledUpPatch
  | TurnBeganPatch
  | TileEffectChangedPatch
  | TileEffectRemovedPatch
  | ItemPickedUpPatch;

/** Узел плана презентации: событие, патч и анимации для одного шага. */
export type PresentationNode = {
  event: GameEvent;
  patch: DisplayPatch;
  animations: AnimationNode[] | null;
  /** true, если событие происходит на поле и подлежит FOV-фильтрации. */
  isFieldAnimation: boolean;
  /** Родительский узел в дереве событий. */
  parent: PresentationNode | null;
  /** Дочерние узлы в дереве событий. */
  children: PresentationNode[];
  /** Сторона хода, к которой относится узел (для группировки в фазы). */
  side: TurnSide;
};
