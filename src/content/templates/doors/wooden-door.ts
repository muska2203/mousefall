import type {DoorTemplateInput} from '../../schemas';

export const woodenDoor = {
  "id": "wooden_door",
  "interactionKind": "door",
  "maxHp": 3,
  "armor": 2,
  "openSpriteId": "wooden_door_open",
  "placement": {
    "anchorY": 2.0,
    "anchorX": 0.1
  },
  "tags": [
    "flammable"
  ],
  "canHaveStatus": [
    "burning"
  ]
} satisfies DoorTemplateInput;
