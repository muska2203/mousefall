import {GameState} from "@simulation/types.ts";
import {ExecutionBuilder, ExecutionNode, Intent} from "@simulation/core-types.ts";

// Реэкспорт базовых типов для обратной совместимости потребителей
export type {
  Intent,
  MoveIntent,
  DamageIntent,
  DieIntent,
  ApplyStatusIntent,
  ChangeFloorIntent,
  ConsumeMpIntent,
  SetCooldownIntent,
  ConsumeApIntent,
  TickStatusEffectsIntent,
  SpawnItemIntent,
  PickUpIntent,
} from "@simulation/core-types.ts";

export type IntentExecutor<T extends Intent> = (
  state: GameState,
  intent: T,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => ExecutionNode | null;
