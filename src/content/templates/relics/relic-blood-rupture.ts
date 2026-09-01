import type {RelicTemplateInput} from '../../schemas';

/**
 * «Разрыватель» (кровавая ветка, этап 3 плана docs/plans/bleed-builds-implementation.md).
 * Минус — relic_blood_rupture_detonation (polarity negative): смерть кровоточащего
 * бьёт всех в радиусе 1, включая владельца (селектор без excludeSelf).
 * Плюс — relic_blood_rupture_bleed_splash: выжившие в радиусе подхватывают кровотечение.
 */
export const relicBloodRupture = {
  "id": "relic_blood_rupture",
  "ruleIds": [
    "relic_blood_rupture_detonation",
    "relic_blood_rupture_bleed_splash"
  ],
  "statModifiers": [],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_blood_rupture.png",
  "fallback": "💥",
  "rarity": "common"
} satisfies RelicTemplateInput;
