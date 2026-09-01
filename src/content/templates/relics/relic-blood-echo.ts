import type {RelicTemplateInput} from '../../schemas';

/**
 * «Кровавое эхо» (кровавая ветка, этап 3 плана docs/plans/bleed-builds-implementation.md).
 * Плюс — relic_blood_echo_heal_on_bleed_kill: добивание кровоточащего лечит владельца.
 * Минус — relic_blood_echo_bleed_faded (polarity negative): спадание кровотечения
 * у любой сущности наносит владельцу 1 внутренний урон.
 */
export const relicBloodEcho = {
  "id": "relic_blood_echo",
  "ruleIds": [
    "relic_blood_echo_heal_on_bleed_kill",
    "relic_blood_echo_bleed_faded"
  ],
  "statModifiers": [],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_blood_echo.png",
  "fallback": "🩸",
  "rarity": "common"
} satisfies RelicTemplateInput;
