import {GameState} from "@simulation/types.ts";
import {ExecutionBuilder, ExecutionNode, Intent, OpenDoorIntent, CloseDoorIntent} from "@simulation/core-types.ts";

// Реэкспорт базовых типов для обратной совместимости потребителей
export type {
  Intent,
  MoveIntent,
  JumpIntent,
  PushIntent,
  DamageIntent,
  DieIntent,
  ApplyStatusIntent,
  ChangeFloorIntent,
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
  BeginCastIntent,
  HealIntent,
  RemoveItemIntent,
  OpenDoorIntent,
  CloseDoorIntent,
  BumpIntent,
} from "@simulation/core-types.ts";

export type OpenDoorIntentExecutor = IntentExecutor<OpenDoorIntent>;
export type CloseDoorIntentExecutor = IntentExecutor<CloseDoorIntent>;

export type IntentExecutor<T extends Intent> = (
  state: GameState,
  intent: T,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => ExecutionNode | null;
