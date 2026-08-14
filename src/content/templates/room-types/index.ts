import type {RoomTypeTemplateInput} from '../../schemas';
import {bossRoom} from './boss';
import {normalDeepRoom} from './normal-deep';
import {normalRoom} from './normal';
import {rewardRoom} from './reward';
import {startRoom} from './start';

/** Все шаблоны категории «roomTypes». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const roomTypeTemplates: RoomTypeTemplateInput[] = [
  startRoom,
  normalRoom,
  normalDeepRoom,
  bossRoom,
  rewardRoom,
];
