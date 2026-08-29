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
  "finalFloor": 1,
  "bossPool": [
    "cat_guardian"
  ]
} satisfies MapParamsInput;
