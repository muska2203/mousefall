import type {ModifierTemplateInput} from '../../schemas';

/**
 * «Стражникова»: фирменный stat-модификатор лат стражника (cat_guardian_plate),
 * детерминированно добавляет +10 к максимуму здоровья (scaling: fixed).
 * В случайном ролле не участвует.
 */
export const modGuardianVitality = {
  "id": "mod_guardian_vitality",
  "effect": {
    "kind": "stat",
    "stat": "maxHp",
    "op": "add"
  },
  "scaling": {
    "kind": "fixed",
    "value": 10
  },
  "applicableSubtypes": ["heavy"],
  "poolEligible": false
} satisfies ModifierTemplateInput;
