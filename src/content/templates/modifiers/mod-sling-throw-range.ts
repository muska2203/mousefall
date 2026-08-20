import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Дальнобойная»: фирменный stat-модификатор пращи (common_sling),
 * детерминированно добавляет +5 к дальности броска расходников (scaling: fixed).
 * Возвращает дальность бросков с базовых 2 клеток до 7 (концепт этажа 1, §4.3/§4.6).
 * В случайном ролле не участвует.
 */
export const modSlingThrowRange = {
  "id": "mod_sling_throw_range",
  "effect": {
    "kind": "stat",
    "stat": "throwRange",
    "op": "add"
  },
  "scaling": {
    "kind": "fixed",
    "value": 5
  },
  "applicableSubtypes": ["sling"],
  "poolEligible": false
} satisfies ModifierTemplateInput;
