/**
 * Точка врезки модификаторов интентов в боевой цикл.
 *
 * При выключенном флаге `contentRulesEnabled` возвращает исходный интент без
 * изменений, сохраняя старое поведение.
 */

import type { Intent } from '@simulation/core-types.ts';
import type { GameState } from '@simulation/types.ts';
import { applyIntentModifiers } from './modifiers/apply-intent-modifiers.ts';
import type { RuleContext } from './rule-context.ts';
import { isContentRulesEnabled } from './feature-flags.ts';

/**
 * Применяет модифицирующие правила к интенту, только если включен флаг
 * контентных правил. Иначе возвращает исходный интент.
 */
export function applyIntentModifiersIfEnabled(
  state: GameState,
  intent: Intent,
  ctx: RuleContext,
): Intent {
  return isContentRulesEnabled(state) ? applyIntentModifiers(state, intent, ctx) : intent;
}
