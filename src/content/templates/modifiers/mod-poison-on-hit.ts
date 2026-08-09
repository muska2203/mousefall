import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Отравляющий клинок»: положительный rule-аффикс, добавляет правило
 * weapon_poison_on_hit. Уровне-независимый (scaling: none, value = null).
 */
export const modPoisonOnHit = {
  "id": "mod_poison_on_hit",
  "polarity": "positive",
  "effect": {
    "kind": "rule",
    "ruleId": "weapon_poison_on_hit"
  },
  "scaling": {
    "kind": "none"
  },
  "applicableSubtypes": ["sword", "dagger", "club", "staff"],
  "weight": 1
} satisfies ModifierTemplateInput;
