import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Угольная»: фирменный rule-модификатор огненного амулета (common_ember_amulet),
 * добавляет правило amulet_fire_damage_multiplier. В случайном ролле не участвует.
 */
export const modAmuletFireDamageMultiplier = {
  "id": "mod_amulet_fire_damage_multiplier",
  "effect": {
    "kind": "rule",
    "ruleId": "amulet_fire_damage_multiplier"
  },
  "scaling": {
    "kind": "none"
  },
  "applicableSubtypes": ["charm"],
  "poolEligible": false
} satisfies ModifierTemplateInput;
