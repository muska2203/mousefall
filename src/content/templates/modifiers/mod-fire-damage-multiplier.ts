import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Пылающая»: фирменный rule-модификатор огненного меча (common_flaming_sword),
 * добавляет правило item_fire_damage_multiplier. В случайном ролле не участвует.
 */
export const modFireDamageMultiplier = {
  "id": "mod_fire_damage_multiplier",
  "effect": {
    "kind": "rule",
    "ruleId": "item_fire_damage_multiplier"
  },
  "scaling": {
    "kind": "none"
  },
  "applicableSubtypes": ["sword"],
  "poolEligible": false
} satisfies ModifierTemplateInput;
