import type {RelicTemplateInput} from '../../schemas';

/**
 * «Жатва» (кровавая ветка, этап 3 плана docs/plans/bleed-builds-implementation.md).
 * Плюс — relic_blood_reaper_harvest: добивание кровоточащего возвращает 1 AP.
 * Минус — relic_blood_reaper_foreign_harvest (polarity negative): кровоточащий,
 * умерший не от руки владельца, отнимает у владельца 1 AP.
 */
export const relicBloodReaper = {
  "id": "relic_blood_reaper",
  "ruleIds": [
    "relic_blood_reaper_harvest",
    "relic_blood_reaper_foreign_harvest"
  ],
  "statModifiers": [],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_blood_reaper.png",
  "fallback": "⚰️",
  "rarity": "common"
} satisfies RelicTemplateInput;
