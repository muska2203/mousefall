/**
 * Точка входа для анимационного планировщика.
 *
 * Ответственность:
 * - Регистрация всех стандартных builders для GameEvent.
 * - Реэкспорт публичного API: buildAnimationTree, registerAnimationBuilder.
 */

import { registerAnimationBuilder } from './core/registry';

// Регистрация базовых builders.
import { entityMovedBuilder } from './builders/entityMoved';
import { actionAppliedBuilder } from './builders/actionApplied';
import { entityDamagedBuilder } from './builders/entityDamaged';
import { entityDiedBuilder } from './builders/entityDied';
import { fogUpdatedBuilder } from './builders/fogUpdated';
import { entityBumpedBuilder } from './builders/entityBumped';
import { itemDroppedBuilder } from './builders/itemDropped';
import { doorOpenedBuilder } from './builders/doorOpened';
import { doorClosedBuilder } from './builders/doorClosed';
import { entityHealedBuilder } from './builders/entityHealed';
import { castCancelledBuilder } from './builders/castCancelled';
import { statusAppliedBuilder } from './builders/statusApplied';
import { statusTickedBuilder } from './builders/statusTicked';
import { statusStacksAdjustedBuilder } from './builders/statusStacksAdjusted';
import { abilityUsedBuilder } from './builders/abilityUsed';
import { castResolvedBuilder } from './builders/castResolved';

// Регистрация скилловых composers (side-effect).
import './skills/fireball';
import './skills/dash';
import './skills/swoop';

registerAnimationBuilder('ENTITY_MOVED', entityMovedBuilder);
registerAnimationBuilder('ACTION_APPLIED', actionAppliedBuilder);
registerAnimationBuilder('ENTITY_DAMAGED', entityDamagedBuilder);
registerAnimationBuilder('ENTITY_DIED', entityDiedBuilder);
registerAnimationBuilder('FOG_UPDATED', fogUpdatedBuilder);
registerAnimationBuilder('ENTITY_BUMPED', entityBumpedBuilder);
registerAnimationBuilder('ITEM_DROPPED', itemDroppedBuilder);
registerAnimationBuilder('DOOR_OPENED', doorOpenedBuilder);
registerAnimationBuilder('DOOR_CLOSED', doorClosedBuilder);
registerAnimationBuilder('ENTITY_HEALED', entityHealedBuilder);
registerAnimationBuilder('CAST_CANCELLED', castCancelledBuilder);
registerAnimationBuilder('STATUS_APPLIED', statusAppliedBuilder);
registerAnimationBuilder('STATUS_TICKED', statusTickedBuilder);
registerAnimationBuilder('STATUS_STACKS_ADJUSTED', statusStacksAdjustedBuilder);
registerAnimationBuilder('ABILITY_USED', abilityUsedBuilder);
registerAnimationBuilder('CAST_RESOLVED', castResolvedBuilder);

export { buildAnimationTree } from './core/treeBuilder';
export { registerAnimationBuilder } from './core/registry';
