import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Рваные края»: положительный rule-аффикс мечей кровавой ветки, добавляет
 * правило weapon_bleeding_widening (удар по уже кровоточащей цели продлевает
 * кровотечение до 5 ходов). Участвует в ролле аффиксов мечей.
 * Уровне-независимый (scaling: none, value = null).
 */
export const modBloodWideningWound = {
  "id": "mod_blood_widening_wound",
  "polarity": "positive",
  "effect": {
    "kind": "rule",
    "ruleId": "weapon_bleeding_widening"
  },
  "scaling": {
    "kind": "none"
  },
  "applicableSubtypes": ["sword"],
  "weight": 1
} satisfies ModifierTemplateInput;
