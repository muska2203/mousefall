import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Крепкая броня»: положительный stat-аффикс, добавляет броню.
 * Рейнжи по уровням: 1 → 1–2, 2 → 1–3, 3 → 2–4.
 */
export const modSturdyArmor = {
  "id": "mod_sturdy_armor",
  "polarity": "positive",
  "effect": {
    "kind": "stat",
    "stat": "armor",
    "op": "add"
  },
  "scaling": {
    "kind": "perLevel",
    "ranges": [
      { "min": 1, "max": 2 },
      { "min": 1, "max": 3 },
      { "min": 2, "max": 4 }
    ]
  },
  "applicableSubtypes": ["light", "heavy", "magic"],
  "weight": 1
} satisfies ModifierTemplateInput;
