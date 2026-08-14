import type {RoomTypeTemplateInput} from '../../schemas';

/**
 * Босс-комната этажа (roadMap 1.3). Не участвует во взвешенном ролле
 * (weight: 0) — генератор назначает её напрямую самому дальнему узлу
 * дерева комнат при заданном bossPool карты. Наполнение пустое: босс
 * спавнится генератором отдельно.
 */
export const bossRoom = {
  id: 'boss',
  kind: 'generated',
  weight: 0,
  minDepth: 0,
  maxPerFloor: 1,
  minSize: 7,
  maxSize: 10,
  fill: {},
} satisfies RoomTypeTemplateInput;
