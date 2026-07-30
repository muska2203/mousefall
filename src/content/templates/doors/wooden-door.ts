import type {DoorTemplateInput} from '../../schemas';

export const woodenDoor = {
  "id": "wooden_door",
  "interactionKind": "door",
  "maxHp": 3,
  "armor": 2,
  "renderScale": 1,
  "openSpriteId": "wooden_door_open",
  "tags": [
    "flammable"
  ],
  "canHaveStatus": [
    "burning"
  ]
} satisfies DoorTemplateInput;
