import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Кровавые шипы»: положительный rule-аффикс брони кровавой ветки, добавляет
 * правило armor_bleeding_thorns (при получении урона в ближнем бою открывает
 * кровотечение на 2 хода у нападающего). Участвует в ролле аффиксов брони.
 * Уровне-независимый (scaling: none, value = null).
 */
export const modBloodThorns = {
  "id": "mod_blood_thorns",
  "polarity": "positive",
  "effect": {
    "kind": "rule",
    "ruleId": "armor_bleeding_thorns"
  },
  "scaling": {
    "kind": "none"
  },
  "applicableSubtypes": ["light", "heavy"],
  "weight": 1
} satisfies ModifierTemplateInput;
