import type {MapParamsInput} from '../../schemas';
import {defaultMap} from './default';
import {floor1} from './floor-1';
import {floor2} from './floor-2';

/** Все шаблоны категории «maps». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const mapParams: MapParamsInput[] = [
  defaultMap,
  floor1,
  floor2,
];
