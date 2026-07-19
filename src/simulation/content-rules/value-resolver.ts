/**
 * Разрешение параметризованных числовых значений контентных правил.
 *
 * Превращает `ParametrizedValue` (константа или ссылка на поле контекста)
 * в конкретное число, которое можно передать в интент или условие.
 */

import type {RuleContext} from './rule-context.ts';
import type {ParametrizedValue} from './types.ts';

/**
 * Преобразует `number | ParametrizedValue` в число по правилам контекста.
 *
 * Для `context`-значений поддерживается:
 * - `multiply` — умножение извлечённого значения;
 * - `min` — нижняя граница после умножения;
 * - `round` — округление до ближайшего целого (`Math.round`).
 */
export function resolveParametrizedValue(
  value: number | ParametrizedValue,
  ctx: RuleContext,
): number {
  if (typeof value === 'number') {
    return value;
  }

  switch (value.type) {
    case 'literal':
      return value.value;

    case 'context': {
      let v = ctx[value.field] ?? 0;

      if (value.multiply !== undefined) {
        v *= value.multiply;
      }

      if (value.min !== undefined) {
        v = Math.max(v, value.min);
      }

      if (value.round === true) {
        v = Math.round(v);
      }

      return v;
    }

    default:
      return 0;
  }
}
