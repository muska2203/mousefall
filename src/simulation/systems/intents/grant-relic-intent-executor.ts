/**
 * Исполнитель интента GRANT_RELIC.
 *
 * Добавляет реликвию в коллекцию игрока:
 * - запись экземпляра в player.relics (каждый стак — отдельная запись);
 * - постоянные модификаторы шаблона с уникальным source на стак
 *   (`relic_{instanceId}` — иначе стаки перезаписывались бы вместо суммирования);
 * - регистрация правил шаблона с уникальным ownerContext на стак.
 *
 * Отказы (возврат null):
 * - сущность не игрок, шаблон не найден;
 * - достигнут лимит MAX_RELICS;
 * - нестакаемая реликвия уже есть в коллекции.
 */

import {GameState, PlayerEntity} from "@simulation/types.ts";
import {nextEntityId} from "@simulation/state.ts";
import {GrantRelicIntent, IntentExecutor} from "@simulation/systems/intents/types.ts";
import {ExecutionBuilder, ExecutionNode} from "@simulation/systems/actions/types.ts";
import {tryGetRelic} from "@content/registry";
import {addModifier, removeModifiersBySource} from "@simulation/systems/stats/modifier-engine.ts";
import {recalculateActorStats} from "@simulation/systems/stats/recalculate.ts";
import {addActiveRulesForRelic, removeActiveRulesForRelic} from "@simulation/systems/rules/active-rule-lifecycle.ts";
import {MAX_RELICS} from "@utils/constants.ts";

/** Source модификаторов экземпляра реликвии (уникален на стак). */
export function relicModifierSource(relicInstanceId: string): string {
  return `relic_${relicInstanceId}`;
}

export const executeGrantRelicIntent: IntentExecutor<GrantRelicIntent> = (
  state: GameState,
  intent: GrantRelicIntent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) => {
  const player = state.entities.get(intent.entityId);
  if (!player || player.type !== 'player') return null;

  const template = tryGetRelic(intent.templateId);
  if (!template) return null;

  if (player.relics.length >= MAX_RELICS) return null;

  if (!template.stackable && player.relics.some(r => r.templateId === intent.templateId)) return null;

  const instanceId = nextEntityId(state, 'relic');
  player.relics.push({ instanceId, templateId: intent.templateId });

  const source = relicModifierSource(instanceId);
  for (const mod of template.statModifiers) {
    addModifier(player, { ...mod, source });
  }

  recalculateActorStats(player);

  addActiveRulesForRelic(player, instanceId, template.ruleIds ?? []);

  return builder.addChild(parent, {
    type: 'RELIC_GRANTED', isFieldEvent: false,
    entityId: intent.entityId,
    relicId: intent.templateId,
    instanceId,
  });
};

/**
 * Удаляет экземпляр реликвии из коллекции игрока:
 * запись из массива, модификаторы по source и правила по ownerContext.
 * Заготовка для механики «замены реликвий» (без UI).
 */
export function removeRelicFromPlayer(player: PlayerEntity, relicInstanceId: string): void {
  player.relics = player.relics.filter(r => r.instanceId !== relicInstanceId);
  removeModifiersBySource(player, relicModifierSource(relicInstanceId));
  removeActiveRulesForRelic(player, relicInstanceId);
  recalculateActorStats(player);
}
