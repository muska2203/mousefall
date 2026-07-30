import type {PoiTemplateInput} from '../../schemas';
import {altar} from './altar';

/** Все шаблоны категории «pois». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const poiTemplates: PoiTemplateInput[] = [
  altar,
];
