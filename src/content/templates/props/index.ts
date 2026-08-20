import type {PropTemplateInput} from '../../schemas';
import {flourBag} from './flour-bag';
import {oilBarel} from './oil-barel';

/** Все шаблоны категории «props». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const propTemplates: PropTemplateInput[] = [
  flourBag,
  oilBarel,
];
