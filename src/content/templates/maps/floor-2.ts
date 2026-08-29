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
  "startRoomTypeId": "start"
} satisfies MapParamsInput;
