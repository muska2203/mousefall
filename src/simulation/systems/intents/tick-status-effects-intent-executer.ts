import {GameState} from "@simulation/types.ts";
import {TickStatusEffectsIntent, ExecutionBuilder, ExecutionNode} from "@simulation/core-types.ts";
import {IntentExecutor} from "@simulation/systems/intents/types.ts";

export const executeTickStatusEffectsIntent: IntentExecutor<TickStatusEffectsIntent> = (
  state,
  intent,
  builder,
  parent,
) => {
  const entity = state.entities.get(intent.entityId) ?? state.player;
  if (!entity || !('statusEffects' in entity)) return null;

  const holder = entity as unknown as { statusEffects: Array<{ type: string; duration: number; value: number }> };
  let totalDamage = 0;

  for (const effect of holder.statusEffects) {
    switch (effect.type) {
      case 'burning': {
        const maxHp = 'maxHp' in entity ? entity.maxHp : 0;
        const damage = Math.max(1, Math.round(maxHp * 0.1));
        totalDamage += damage;
        if ('hp' in entity) {
          entity.hp = Math.max(0, entity.hp - damage);
        }
        break;
      }
    }
    effect.duration -= 1;
  }

  const expired = holder.statusEffects.filter(e => e.duration <= 0);
  holder.statusEffects = holder.statusEffects.filter(e => e.duration > 0);

  let node = parent;
  if (totalDamage > 0) {
    node = builder.addChild(parent, {
      type: 'ENTITY_DAMAGED',
      targetId: entity.id,
      damage: totalDamage,
      position: { x: entity.x, y: entity.y },
    });
  }

  for (const effect of expired) {
    builder.addChild(node, {
      type: 'STATUS_REMOVED',
      entityId: entity.id,
      effectType: effect.type as import("@simulation/core-types.ts").StatusEffectType,
    });
  }

  return node;
};
