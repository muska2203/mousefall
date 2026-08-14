import type {DoorTemplateInput} from '../../schemas';

/**
 * Дверь босс-комнаты: неразрушаемая (флаг indestructible) и негорючая
 * (нет тега flammable и пустой canHaveStatus). Спрайты переиспользуют
 * деревянную дверь — отдельный визуал появится на этапе presentation.
 */
export const bossDoor = {
  "id": "boss_door",
  "interactionKind": "door",
  "maxHp": 3,
  "armor": 2,
  "indestructible": true,
  "openSpriteId": "wooden_door_open",
  "spriteVariants": {
    "default": "wooden_door",
    "open": "wooden_door_open"
  },
  "placement": {
    "anchorY": 1.0
  },
  "tags": [
    "boss_room"
  ],
  "canHaveStatus": []
} satisfies DoorTemplateInput;
