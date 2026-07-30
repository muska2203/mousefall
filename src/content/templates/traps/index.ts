import type {TrapTemplateInput} from '../../schemas';
import {spikes} from './spikes';

/** Все шаблоны категории «traps». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const trapTemplates: TrapTemplateInput[] = [
  spikes,
];
