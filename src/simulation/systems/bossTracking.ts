/**
 * Трекинг боссов в Simulation.
 *
 * Принадлежность шаблона к боссам определяется флагом `isBoss` в шаблоне
 * сущности (Content). При убийстве врага с таким templateId его ID
 * добавляется в runStats.defeatedBossIds (см. die-intent-executer.ts).
 */

import {tryGetEntity} from '@content/registry';

/** Возвращает true, если шаблон сущности помечен как босс (`isBoss` в контенте). */
export function isBossTemplate(templateId: string): boolean {
  return tryGetEntity(templateId)?.isBoss ?? false;
}
