import type {TrapTemplateInput} from '../../schemas';
import {spikes} from './spikes';
import {mousetrap} from './mousetrap';

/** Все шаблоны категории «traps». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const trapTemplates: TrapTemplateInput[] = [
  spikes,
  mousetrap,
];
