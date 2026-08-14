import {GameState} from "@simulation/types.ts";
import {
    CloseDoorIntent,
    ExecutionBuilder,
    ExecutionNode,
    Intent,
    LockDoorIntent,
    OpenDoorIntent,
    SetEntitiesIntent,
    SetMapIntent,
    TeleportEntityIntent,
    UnlockDoorIntent,
    UpdateFogIntent
} from "@simulation/core-types.ts";

// Реэкспорт базовых типов для обратной совместимости потребителей
export type {
  Intent,
  MoveIntent,
  JumpIntent,
  PushIntent,
  DamageIntent,
  DamageTileIntent,
  DieIntent,
  ApplyStatusIntent,
  SetMapIntent,
  SetEntitiesIntent,
  TeleportEntityIntent,
  UpdateFogIntent,
  SetCooldownIntent,
  ConsumeApIntent,
  TickStatusEffectsIntent,
  AdjustStatusStacksIntent,
  SpawnItemIntent,
  PickUpIntent,
  EquipItemIntent,
  UnequipItemIntent,
  GrantAbilityIntent,
  RevokeAbilityIntent,
  GrantRelicIntent,
  HealIntent,
  RemoveItemIntent,
  OpenDoorIntent,
  CloseDoorIntent,
  LockDoorIntent,
  UnlockDoorIntent,
  FloorTransitionIntent,
  BumpIntent,
  RestoreApIntent,
  TickCooldownIntent,
  BeginTurnIntent,
  NotifyAIIntent,
  CounterAttackIntent,
  SpawnTileEffectIntent,
  RemoveTileEffectIntent,
  TickTileEffectsIntent,
  ApplyTileEffectStatusIntent,
  RemoveTileEffectStatusIntent,
  TileExplosionIntent,
  ActivatePoiIntent,
  ResolvePoiChoiceIntent,
  TileEffectInstance,
} from "@simulation/core-types.ts";

export type OpenDoorIntentExecutor = IntentExecutor<OpenDoorIntent>;
export type CloseDoorIntentExecutor = IntentExecutor<CloseDoorIntent>;
export type LockDoorIntentExecutor = IntentExecutor<LockDoorIntent>;
export type UnlockDoorIntentExecutor = IntentExecutor<UnlockDoorIntent>;
export type SetMapIntentExecutor = IntentExecutor<SetMapIntent>;
export type SetEntitiesIntentExecutor = IntentExecutor<SetEntitiesIntent>;
export type TeleportEntityIntentExecutor = IntentExecutor<TeleportEntityIntent>;
export type UpdateFogIntentExecutor = IntentExecutor<UpdateFogIntent>;

export type IntentExecutor<T extends Intent> = (
  state: GameState,
  intent: T,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => ExecutionNode | null;
