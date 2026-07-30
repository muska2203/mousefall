import type {AbilityTemplateInput} from '../../schemas';
import {cleave} from './cleave';
import {counterattack} from './counterattack';
import {dash} from './dash';
import {fireball} from './fireball';
import {magicSlap} from './magic-slap';
import {suddenStrike} from './sudden-strike';
import {swoop} from './swoop';

/** Все шаблоны категории «abilities». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const abilityTemplates: AbilityTemplateInput[] = [
  cleave,
  counterattack,
  dash,
  fireball,
  magicSlap,
  suddenStrike,
  swoop,
];
