import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Бодрящая»: фирменный rule-модификатор амулетов второго дыхания
 * (common_energized_bead, common_knotted_fang), добавляет правило amulet_restore_ap_on_hit.
 * В случайном ролле не участвует.
 */
export const modRestoreApOnHit = {
  "id": "mod_restore_ap_on_hit",
  "effect": {
    "kind": "rule",
    "ruleId": "amulet_restore_ap_on_hit"
  },
  "scaling": {
    "kind": "none"
  },
  "applicableSubtypes": ["bead", "talisman"],
  "poolEligible": false
} satisfies ModifierTemplateInput;
