import type {TileEffectTemplateInput} from '../../schemas';
import {bloodPuddle} from './blood-puddle';
import {flourCloud} from './flour-cloud';
import {oil} from './oil';
import {smoke} from './smoke';
import {water} from './water';

/** Все шаблоны категории «tileEffects». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const tileEffectTemplates: TileEffectTemplateInput[] = [
  bloodPuddle,
  flourCloud,
  oil,
  smoke,
  water,
];
