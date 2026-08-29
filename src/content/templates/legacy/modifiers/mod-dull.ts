import type {ModifierTemplateInput} from '../../../schemas';

/**
 * «Тупой»: отрицательный stat-аффикс, снижает урон оружия.
 * Рейнжи задаются отрицательными значениями — знак не инвертируется рантаймом.
 */
export const modDull = {
  "id": "mod_dull",
  "polarity": "negative",
  "effect": {
    "kind": "stat",
    "stat": "damage",
    "op": "add"
  },
  "scaling": {
    "kind": "perLevel",
    "ranges": [
      { "min": -2, "max": -1 },
      { "min": -3, "max": -1 },
      { "min": -3, "max": -2 }
    ]
  },
  "applicableSubtypes": ["sword", "dagger", "club", "staff"],
  "weight": 1
} satisfies ModifierTemplateInput;
