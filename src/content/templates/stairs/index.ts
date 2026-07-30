import type {StairsTemplateInput} from '../../schemas';
import {stairsDown} from './stairs-down';
import {stairsUp} from './stairs-up';

/** Все шаблоны категории «stairs». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const stairsTemplates: StairsTemplateInput[] = [
  stairsDown,
  stairsUp,
];
