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
  "startRoomTypeId": "start"
} satisfies MapParamsInput;
