import type {RoomTypeTemplateInput} from '../../schemas';

export const startRoom = {
  id: 'start',
  kind: 'generated',
  minSize: 4,
  maxSize: 6,
  fill: {
    guaranteedPois: ['relic_altar'],
  },
} satisfies RoomTypeTemplateInput;
