import type {MapParamsInput} from '../../schemas';

export const floor1 = {
  "id": "floor_1",
  "strategy": "tree",
  "width": 40,
  "height": 40,
  "minRooms": 5,
  "maxRooms": 20,
  "minRoomSize": 3,
  "maxRoomSize": 8,
  "enemyDensity": 1,
  "itemDensity": 0.1,
  "enemyPool": [
    "cat_small",
    "cat_mid",
    "cat_big"
  ],
  "itemPool": [
    "health_potion"
  ],
  "startPoiId": "relic_altar",
  "relicPool": [
    "relic_salamander_heart",
    "relic_venom_gland",
    "relic_acid_blood",
    "relic_plague_bearer",
    "relic_thunderhead",
    "relic_opportunist",
    "relic_blood_pact",
    "relic_scavenger"
  ]
} satisfies MapParamsInput;
