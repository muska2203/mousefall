import type {RoomTypeTemplateInput} from '../../schemas';

/**
 * Комната награды за босс-комнатой (roadMap 1.3). Не участвует во
 * взвешенном ролле (weight: 0) — генератор назначает её напрямую
 * exit-узлу дерева комнат; лестница вниз остаётся в ней.
 */
export const rewardRoom = {
  id: 'reward',
  kind: 'generated',
  weight: 0,
  minDepth: 0,
  maxPerFloor: 1,
  minSize: 4,
  maxSize: 6,
  fill: {
    guaranteedPois: ['altar'],
  },
} satisfies RoomTypeTemplateInput;
