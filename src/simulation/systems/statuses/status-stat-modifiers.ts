import type {StatActor, StatusEffect} from '@simulation/types';
import type {StatusTemplate} from '@content/schemas';
import {addModifier, removeModifiersBySource} from '@simulation/systems/stats/modifier-engine';

/**
 * Жизненный цикл stat-модификаторов статуса.
 *
 * Модификаторы из `StatusTemplate.statModifiers` применяются к актору при
 * наложении статуса (source — instanceId экземпляра статуса) и снимаются
 * на каждом пути удаления статуса (expire, вытеснение, стеки → 0, stunned).
 */

/** Применяет stat-модификаторы шаблона статуса к актору. */
export function applyStatusStatModifiers(
  actor: StatActor,
  statusInstanceId: string,
  template: StatusTemplate | null,
): void {
  for (const modifier of template?.statModifiers ?? []) {
    addModifier(actor, { ...modifier, source: statusInstanceId });
  }
}

/** Снимает stat-модификаторы, применённые указанным экземпляром статуса. */
export function removeStatusStatModifiers(
  actor: StatActor,
  effect: Pick<StatusEffect, 'instanceId' | 'type'>,
): void {
  removeModifiersBySource(actor, effect.instanceId ?? effect.type);
}
