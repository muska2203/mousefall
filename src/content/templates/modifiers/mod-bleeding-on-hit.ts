import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Режущая»: положительный rule-аффикс мечей, добавляет правило
 * weapon_bleeding_on_hit (кровотечение при ударе рубящим уроном).
 * Фирменное свойство «Зазубренного сырореза»; также участвует в ролле
 * аффиксов мечей. Уровне-независимый (scaling: none, value = null).
 */
export const modBleedingOnHit = {
  "id": "mod_bleeding_on_hit",
  "polarity": "positive",
  "effect": {
    "kind": "rule",
    "ruleId": "weapon_bleeding_on_hit"
  },
  "scaling": {
    "kind": "none"
  },
  "applicableSubtypes": ["sword"],
  "weight": 1
} satisfies ModifierTemplateInput;
