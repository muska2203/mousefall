import type {RelicTemplateInput} from '../../schemas';

/**
 * «Кровавое топливо» (кровавая ветка, этап 3 плана docs/plans/bleed-builds-implementation.md).
 * Плюс — relic_blood_fuel_self_tick: тик собственного кровотечения возвращает 1 AP.
 * Минус — relic_blood_fuel_exsanguinated (polarity negative): спадание кровотечения
 * владельца отнимает 1 AP.
 */
export const relicBloodFuel = {
  "id": "relic_blood_fuel",
  "ruleIds": [
    "relic_blood_fuel_self_tick",
    "relic_blood_fuel_exsanguinated"
  ],
  "statModifiers": [],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_blood_fuel.png",
  "fallback": "🕯️",
  "rarity": "common"
} satisfies RelicTemplateInput;
