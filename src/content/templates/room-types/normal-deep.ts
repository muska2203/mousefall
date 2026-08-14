import type {RoomTypeTemplateInput} from '../../schemas';

/**
 * Обычная комната второго этажа (черновик до полноценного дизайна этажа 2):
 * те же коты, больше лута, без пропов и ловушек.
 */
export const normalDeepRoom = {
  id: 'normal_deep',
  kind: 'generated',
  minSize: 4,
  maxSize: 12,
  fill: {
    enemyPool: ['cat_small', 'cat_mid'],
    enemyDensity: 0.7,
    itemPool: ['health_potion', 'common_splinter_blade', 'common_tin_plate'],
    itemDensity: 0.2,
  },
} satisfies RoomTypeTemplateInput;
