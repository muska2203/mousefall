import type {RelicTemplateInput} from '../../schemas';

/**
 * «Пиявка» (кровавая ветка, этап 3 плана docs/plans/bleed-builds-implementation.md).
 * Плюс — правило relic_blood_leech_tick_heal: тик чужого кровотечения рядом лечит владельца.
 * Минус «Истощение» — отрицательный statModifier (−5 maxHp), без правила.
 */
export const relicBloodLeech = {
  "id": "relic_blood_leech",
  "ruleIds": [
    "relic_blood_leech_tick_heal"
  ],
  "statModifiers": [
    { "stat": "maxHp", "value": -5, "op": "add" }
  ],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_blood_leech.png",
  "fallback": "🪱",
  "rarity": "common"
} satisfies RelicTemplateInput;
