import type {DoorTemplateInput} from '../../schemas';
import {woodenDoor} from './wooden-door';

/** Все шаблоны категории «doors». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const doorTemplates: DoorTemplateInput[] = [
  woodenDoor,
];
