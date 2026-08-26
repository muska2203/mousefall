import type {RoomTypeTemplateInput} from '../../schemas';

export const startRoom = {
  id: 'start',
  kind: 'generated',
  minSize: 4,
  maxSize: 6,
  fill: {},
} satisfies RoomTypeTemplateInput;
