import type {TileEffectTemplateInput} from '../../schemas';
import {oil} from './oil';
import {smoke} from './smoke';
import {water} from './water';

/** Все шаблоны категории «tileEffects». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const tileEffectTemplates: TileEffectTemplateInput[] = [
  oil,
  smoke,
  water,
];
