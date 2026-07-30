import type {PlayerTemplateInput} from '../../schemas';
import {elvenRanger} from './elven-ranger';
import {halflingMage} from './halfling-mage';
import {necromancer} from './necromancer';
import {orcBarbarian} from './orc-barbarian';
import {paladin} from './paladin';
import {samurai} from './samurai';
import {witcher} from './witcher';

/** Все шаблоны категории «players». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const playerTemplates: PlayerTemplateInput[] = [
  elvenRanger,
  halflingMage,
  necromancer,
  orcBarbarian,
  paladin,
  samurai,
  witcher,
];
