import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Добивающая»: положительный rule-аффикс мечей, добавляет правило
 * weapon_bleeding_execute (+3 урона оружием по кровоточащим целям).
 * Только ролл аффиксов (концепт этажа 1, §4.3 — «на втором мече или в пуле
 * аффиксов»; решено — в пуле). Уровне-независимый (scaling: none, value = null).
 */
export const modBloodExecute = {
  "id": "mod_blood_execute",
  "polarity": "positive",
  "effect": {
    "kind": "rule",
    "ruleId": "weapon_bleeding_execute"
  },
  "scaling": {
    "kind": "none"
  },
  "applicableSubtypes": ["sword"],
  "weight": 1
} satisfies ModifierTemplateInput;
