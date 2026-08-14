import type {MapParamsInput} from '../../schemas';

export const floor2 = {
  "id": "floor_2",
  "strategy": "tree",
  "width": 60,
  "height": 60,
  "minRooms": 8,
  "maxRooms": 14,
  "roomTypePool": [
    "normal_deep"
  ],
  "startRoomTypeId": "start",
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
