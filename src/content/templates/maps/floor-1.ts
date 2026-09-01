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
  "relicPool": [
    "relic_blood_leech",
    "relic_blood_echo",
    "relic_blood_reaper",
    "relic_blood_fuel",
    "relic_blood_rupture",
    "relic_blood_pact"
  ],
  "finalFloor": 1,
  "bossPool": [
    "cat_guardian"
  ]
} satisfies MapParamsInput;
