import type {EntityTemplateInput} from '../../schemas';
import {catBig} from './cat-big';
import {catGuardian} from './cat-guardian';
import {catMid} from './cat-mid';
import {catSmall} from './cat-small';

/** Все шаблоны категории «entities». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const entityTemplates: EntityTemplateInput[] = [
  catBig,
  catGuardian,
  catMid,
  catSmall,
];
