import type {ModifierTemplateInput} from '../../../schemas';

/**
 * «Хрупкий»: отрицательный stat-аффикс, снижает максимум HP.
 * Рейнжи задаются отрицательными значениями — знак не инвертируется рантаймом.
 */
export const modFragile = {
  "id": "mod_fragile",
  "polarity": "negative",
  "effect": {
    "kind": "stat",
    "stat": "maxHp",
    "op": "add"
  },
  "scaling": {
    "kind": "perLevel",
    "ranges": [
      { "min": -2, "max": -1 },
      { "min": -3, "max": -1 },
      { "min": -4, "max": -2 }
    ]
  },
  "applicableSubtypes": ["light", "heavy", "magic", "bead", "charm", "talisman"],
  "weight": 1
} satisfies ModifierTemplateInput;
