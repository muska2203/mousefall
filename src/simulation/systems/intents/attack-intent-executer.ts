import {GameState} from "@simulation/types.ts";
import {DamageIntent, IntentExecutor} from "@simulation/systems/intents/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {findAttackableEntity} from "@simulation/state.ts";
import { getEffectiveArmor } from "@simulation/systems/stats/effective-stats.ts";

export const executeDamageIntent: IntentExecutor<DamageIntent> = (
    state: GameState,
    intent: DamageIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    const target = findAttackableEntity(state, intent.entityId);
    if (target) {
        const armor = getEffectiveArmor(target);
        const rawDamage = Math.max(1, Math.round(intent.damage - armor));
        const finalDamage = Math.max(1, rawDamage);
        target.hp -= finalDamage;
        return builder.addChild(parent, {type: 'ENTITY_DAMAGED', damage: finalDamage, targetId: intent.entityId, position: {x: target.x, y: target.y}})
    }
    return null;
}