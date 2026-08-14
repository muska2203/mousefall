import type {MapParamsInput} from '../../schemas';

export const defaultMap = {
  "id": "default",
  "strategy": "tree",
  "width": 30,
  "height": 30,
  "minRooms": 5,
  "maxRooms": 20,
  "roomTypePool": [
    "normal"
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
