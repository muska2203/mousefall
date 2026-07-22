/**
 * Регистрация стандартных animation builders и скилловых композеров.
 *
 * Этот модуль выполняет только side-effect: регистрирует builders в registry.
 * Публичный API для вызовов находится в animation/index.ts.
 */

import {registerAnimationBuilder} from './core/registry';

// Регистрация базовых builders.
import {entityMovedBuilder} from './builders/entityMoved';
import {actionAppliedBuilder} from './builders/actionApplied';
import {entityDamagedBuilder} from './builders/entityDamaged';
import {entityDiedBuilder} from './builders/entityDied';
import {fogUpdatedBuilder} from './builders/fogUpdated';
import {entityBumpedBuilder} from './builders/entityBumped';
import {itemDroppedBuilder} from './builders/itemDropped';
import {doorOpenedBuilder} from './builders/doorOpened';
import {doorClosedBuilder} from './builders/doorClosed';
import {entityHealedBuilder} from './builders/entityHealed';
import {statusAppliedBuilder} from './builders/statusApplied';
import {statusTickedBuilder} from './builders/statusTicked';
import {statusStacksAdjustedBuilder} from './builders/statusStacksAdjusted';
import {abilityUsedBuilder} from './builders/abilityUsed';
import {abilityPreparedBuilder} from './builders/abilityPrepared';
import {abilityPreparedCancelledBuilder} from './builders/abilityPreparedCancelled';
import {counterAttackAppliedBuilder} from './builders/counterAttackApplied';
import {statusBlockedBuilder} from './builders/statusBlocked';
import {statusRemovedBuilder} from './builders/statusRemoved';
import {entityCollidedBuilder} from './builders/entityCollided';
import {entityDisplacedBuilder} from './builders/entityDisplaced';
import {entityMissedBuilder} from './builders/entityMissed';
import {tileEffectChangedBuilder, tileEffectRemovedBuilder, tileEffectStatusAppliedBuilder, tileEffectStatusRemovedBuilder} from './builders/tileEffect';

// Регистрация скилловых composers (side-effect).
import './skills/fireball';
import './skills/dash';
import './skills/swoop';
import './skills/cleave';

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
registerAnimationBuilder('STATUS_APPLIED', statusAppliedBuilder);
registerAnimationBuilder('STATUS_TICKED', statusTickedBuilder);
registerAnimationBuilder('STATUS_STACKS_ADJUSTED', statusStacksAdjustedBuilder);
registerAnimationBuilder('ABILITY_USED', abilityUsedBuilder);
registerAnimationBuilder('ABILITY_PREPARED', abilityPreparedBuilder);
registerAnimationBuilder('ABILITY_PREPARED_CANCELLED', abilityPreparedCancelledBuilder);
registerAnimationBuilder('COUNTER_ATTACK_APPLIED', counterAttackAppliedBuilder);
registerAnimationBuilder('STATUS_BLOCKED', statusBlockedBuilder);
registerAnimationBuilder('STATUS_REMOVED', statusRemovedBuilder);
registerAnimationBuilder('ENTITY_COLLIDED', entityCollidedBuilder);
registerAnimationBuilder('ENTITY_DISPLACED', entityDisplacedBuilder);
registerAnimationBuilder('ENTITY_MISSED', entityMissedBuilder);
registerAnimationBuilder('TILE_EFFECT_CHANGED', tileEffectChangedBuilder);
registerAnimationBuilder('TILE_EFFECT_REMOVED', tileEffectRemovedBuilder);
registerAnimationBuilder('TILE_EFFECT_STATUS_APPLIED', tileEffectStatusAppliedBuilder);
registerAnimationBuilder('TILE_EFFECT_STATUS_REMOVED', tileEffectStatusRemovedBuilder);

// Примечание: FLOOR_CHANGED намеренно не регистрируется здесь.
// Переход между этажами — это мгновенный сброс экрана: UI перестраивает
// карту, сущности и туман войны по новому состоянию без промежуточной
// анимации. Событие остаётся в дереве исполнения для журналирования и
// корректного обновления FOV, но анимационный узел для него не требуется.
