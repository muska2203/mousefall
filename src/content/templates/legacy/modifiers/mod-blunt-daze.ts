import type {ModifierTemplateInput} from '../../../schemas';

/**
 * «Оглушающая»: фирменный rule-модификатор дубины стражника (cat_guardian_maul),
 * добавляет правило weapon_blunt_daze. В случайном ролле не участвует.
 */
export const modBluntDaze = {
  "id": "mod_blunt_daze",
  "effect": {
    "kind": "rule",
    "ruleId": "weapon_blunt_daze"
  },
  "scaling": {
    "kind": "none"
  },
  "applicableSubtypes": ["club"],
  "poolEligible": false
} satisfies ModifierTemplateInput;
