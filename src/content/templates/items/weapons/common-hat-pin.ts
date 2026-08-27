import type {ItemTemplateInput} from '../../../schemas';

/**
 * «Шляпная булавка» — дуэльный меч (линия Бойца, концепт этажа 1, §4.3):
 * колющий урон, фирменная способность sudden_strike (срыв подготовленной
 * способности цели — анти-босс/анти-кастер), пул скиллов —
 * контратака/рывок. Числа черновые — балансный проход roadMap 1.4.
 */
export const commonHatPin = {
  "id": "common_hat_pin",
  "spriteId": "common_hat_pin",
  "icon": "/assets/items/common_hat_pin.png",
  "fallback": "📌",
  "type": "weapon",
  "level": 1,
  "subtype": "sword",
  "stackable": false,
  "maxStack": 1,
  "value": 12,
  "abilityPool": [
    {
      "abilityId": "counterattack",
      "weight": 1
    },
    {
      "abilityId": "dash",
      "weight": 1
    }
  ],
  "weapon": {
    "damage": { "min": 5, "max": 7 },
    "range": 1,
    "damageDistribution": [
      {
        "damageTag": "damage.physical.piercing",
        "weight": 1
      }
    ],
    "tags": [
      "attack.melee",
      "target.single",
      "delivery.weapon"
    ]
  },
  "grantedAbilities": [
    "sudden_strike"
  ],
  "fixedModifiers": []
} satisfies ItemTemplateInput;
