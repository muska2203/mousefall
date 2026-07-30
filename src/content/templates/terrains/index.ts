import type {TerrainTemplateInput} from '../../schemas';
import {floor} from './floor';
import {sand} from './sand';
import {wall} from './wall';

/** Все шаблоны категории «terrains». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const terrainTemplates: TerrainTemplateInput[] = [
  floor,
  sand,
  wall,
];
