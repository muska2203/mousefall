import { GameState, ValidationResult, Entity, Position } from '@simulation/types';
import { ActionHandler, ExecutionBuilder, ExecutionNode, UseAbilityAction } from '@simulation/systems/actions/types';
import { Intent } from '@simulation/systems/intents/types';
import { executeIntent } from '@simulation/systems/intents/execute-intent';
import { getSkillExecutor } from '@simulation/skills/skillExecutor';
import { getAbility } from '@content/registry';

export const useAbilityAction: ActionHandler = {
  validate(state: GameState, action: UseAbilityAction): ValidationResult {
    const actor = state.entities.get(action.entityId);
    if (!actor) {
      return { ok: false, reasonCode: 'actor_not_found' };
    }

    if (!('abilities' in actor)) {
      return { ok: false, reasonCode: 'no_abilities' };
    }

    const runtimeAbility = actor.abilities.find(a => a.templateId === action.abilityId);
    if (!runtimeAbility) {
      return { ok: false, reasonCode: 'ability_not_found' };
    }

    if (runtimeAbility.currentCooldown > 0) {
      return { ok: false, reasonCode: 'ability_on_cooldown' };
    }

    const abilityTemplate = getAbility(action.abilityId);
    if (abilityTemplate.castTime > 0 && 'activeCast' in actor && actor.activeCast !== null) {
      return { ok: false, reasonCode: 'already_casting' };
    }

    const executor = getSkillExecutor(action.abilityId);
    if (!executor) {
      return { ok: false, reasonCode: 'executor_not_found' };
    }

    const validTargets = executor.getValidTargets(state, actor);
    for (const target of action.targets) {
      if (!positionInList(target, validTargets)) {
        return { ok: false, reasonCode: 'invalid_target' };
      }
    }

    const targetMode = executor.getTargetMode(state, actor);
    if (targetMode.type === 'single' && action.targets.length !== 1) {
      return { ok: false, reasonCode: 'wrong_target_count' };
    }
    if (targetMode.type === 'multi' && action.targets.length !== targetMode.count) {
      return { ok: false, reasonCode: 'wrong_target_count' };
    }

    return { ok: true };
  },

  resolve(state: GameState, action: UseAbilityAction): Intent[] {
    const actor = state.entities.get(action.entityId);
    if (!actor) return [];
    const executor = getSkillExecutor(action.abilityId);
    if (!executor) return [];
    const template = getAbility(action.abilityId);

    // Скилл с подготовкой: не применяем эффект сразу, а запускаем каст
    if (template.castTime > 0) {
      const intents: Intent[] = [];
      intents.push({
        type: 'BEGIN_CAST',
        entityId: action.entityId,
        abilityId: action.abilityId,
        targets: action.targets,
        turns: template.castTime,
      });
      return intents;
    }

    const intents = executor.resolve(state, actor, action.targets);

    if (template.cooldown > 0) {
      intents.push({ type: 'SET_COOLDOWN', entityId: action.entityId, abilityId: action.abilityId, turns: template.cooldown });
    }

    return intents;
  },

  execute(
    state: GameState,
    action: UseAbilityAction,
    intents: Intent[],
    executionBuilder: ExecutionBuilder,
    parentNode: ExecutionNode,
  ): void {
    const actor = state.entities.get(action.entityId);
    if (!actor || !('abilities' in actor)) return;

    const template = getAbility(action.abilityId);
    const isCasting = template.castTime > 0;

    // Для способностей с подготовкой не порождаем ABILITY_USED здесь —
    // полная анимация (в том числе fireball) будет привязана к CAST_RESOLVED
    // при автоматическом резолве каста. Исполняем интенты (BEGIN_CAST и т.п.)
    // напрямую под parentNode.
    let node = parentNode;
    if (!isCasting) {
      node = executionBuilder.addChild(parentNode, {
        type: 'ABILITY_USED',
        entityId: action.entityId,
        abilityId: action.abilityId,
        targets: action.targets,
        from: { x: actor.x, y: actor.y },
      });
    }

    // Исполняем интенты как детей события способности,
    // чтобы анимации каста шли до анимаций урона/смерти.
    for (const intent of intents) {
      executeIntent(state, intent, executionBuilder, node);
    }
  },
};

function positionInList(pos: Position, list: Position[]): boolean {
  return list.some(p => p.x === pos.x && p.y === pos.y);
}
