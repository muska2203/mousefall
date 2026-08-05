import type {MapParamsInput} from '../../schemas';

export const floor2 = {
  "id": "floor_2",
  "strategy": "tree",
  "width": 60,
  "height": 60,
  "minRooms": 8,
  "maxRooms": 14,
  "minRoomSize": 4,
  "maxRoomSize": 12,
  "enemyDensity": 0.7,
  "itemDensity": 0.35,
  "enemyPool": [
    "cat_small",
    "cat_mid"
  ],
  "itemPool": [
    "health_potion",
    "common_splinter_blade",
    "common_tin_plate"
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
