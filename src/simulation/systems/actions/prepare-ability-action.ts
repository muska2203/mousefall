import { GameState, ValidationResult, EnemyEntity } from '@simulation/types';
import { ActionHandler, ExecutionBuilder, ExecutionNode, PrepareAbilityAction } from '@simulation/systems/actions/types';
import { Intent } from '@simulation/systems/intents/types';
import { executeIntent } from '@simulation/systems/intents/execute-intent';
import { validateAbilityTargets } from '@simulation/skills/target-validation';
import { getAbility } from '@content/registry';
import { isStunned } from '@simulation/systems/stun-helper';

/**
 * Хендлер действия "подготовить скилл на следующий ход".
 *
 * Используется AI для отложенного выполнения скилла с castTime = 0.
 * Само действие не тратит AP; стоимость списывается при выполнении
 * подготовленного скилла в начале следующего хода AI.
 */
export const prepareAbilityAction: ActionHandler = {
  validate(state: GameState, action: PrepareAbilityAction): ValidationResult {
    const actor = state.entities.get(action.entityId);
    if (!actor) {
      return { ok: false, reasonCode: 'actor_not_found' };
    }
    if (!('abilities' in actor) || !('aiState' in actor)) {
      return { ok: false, reasonCode: 'not_an_ai_actor' };
    }

    if (isStunned(actor)) {
      return { ok: false, reasonCode: 'actor_stunned' };
    }

    const enemy = actor as EnemyEntity;
    if (enemy.aiState.preparedIntent) {
      return { ok: false, reasonCode: 'already_prepared' };
    }

    if ('activeCast' in actor && actor.activeCast !== null) {
      return { ok: false, reasonCode: 'already_casting' };
    }

    const runtimeAbility = actor.abilities.find(a => a.templateId === action.abilityId);
    if (!runtimeAbility) {
      return { ok: false, reasonCode: 'ability_not_found' };
    }

    if (runtimeAbility.currentCooldown > 0) {
      return { ok: false, reasonCode: 'ability_on_cooldown' };
    }

    const template = getAbility(action.abilityId);
    if (!template) {
      return { ok: false, reasonCode: 'ability_template_not_found' };
    }

    if (!template.aiPreparable) {
      return { ok: false, reasonCode: 'ability_not_preparable' };
    }

    const targetValidation = validateAbilityTargets(state, actor, action.abilityId, action.targets);
    if (!targetValidation.ok) {
      return targetValidation;
    }

    return { ok: true };
  },

  resolve(_state: GameState, action: PrepareAbilityAction): Intent[] {
    return [{
      type: 'PREPARE_ABILITY',
      entityId: action.entityId,
      abilityId: action.abilityId,
      targets: action.targets,
    }];
  },

  execute(
    state: GameState,
    _action: PrepareAbilityAction,
    intents: Intent[],
    executionBuilder: ExecutionBuilder,
    parentNode: ExecutionNode,
  ): void {
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, parentNode);
    }
  },
};


