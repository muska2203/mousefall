import type {MapParamsInput} from '../../schemas';

export const floor1 = {
  "id": "floor_1",
  "strategy": "tree",
  "width": 40,
  "height": 40,
  "minRooms": 10,
  "maxRooms": 15,
  "roomTypePool": [
    "normal"
  ],
  "startRoomTypeId": "start",
  "bossPool": [
    "cat_guardian"
  ],
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
