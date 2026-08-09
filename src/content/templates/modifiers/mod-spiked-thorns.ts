import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Шипастая»: фирменный rule-модификатор брони с шипами
 * (common_tin_plate, common_spiked_cloak), добавляет правило armor_spiked_thorns.
 * В случайном ролле не участвует.
 */
export const modSpikedThorns = {
  "id": "mod_spiked_thorns",
  "effect": {
    "kind": "rule",
    "ruleId": "armor_spiked_thorns"
  },
  "scaling": {
    "kind": "none"
  },
  "applicableSubtypes": ["light", "heavy"],
  "poolEligible": false
} satisfies ModifierTemplateInput;
