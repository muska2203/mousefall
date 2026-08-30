import type {ItemTemplateInput} from '../../../schemas';

/**
 * «Жалящий кинжал» — кинжал первой итерации с колющим уроном. Без скиллов.
 * Фирменный модификатор mod_poison_on_hit снят при архивации модификаторов
 * (2026-09-01) — вернётся с их переработкой.
 * Числа черновые — балансный проход roadMap 1.4.
 */
export const weaponDaggerVenom = {
  "id": "weapon_dagger_venom",
  "spriteId": "weapon_dagger_venom",
  "icon": "/assets/items/weapon_dagger_venom.png",
  "fallback": "🗡",
  "type": "weapon",
  "level": 1,
  "subtype": "dagger",
  "stackable": false,
  "maxStack": 1,
  "value": 10,
  "weapon": {
    "damage": { "min": 2, "max": 4 },
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
  "grantedAbilities": []
} satisfies ItemTemplateInput;
