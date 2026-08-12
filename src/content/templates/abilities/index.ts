import type {AbilityTemplateInput} from '../../schemas';
import {bulwark} from './bulwark';
import {cleave} from './cleave';
import {counterattack} from './counterattack';
import {dash} from './dash';
import {fireball} from './fireball';
import {groundSlam} from './ground-slam';
import {guardianSwoop} from './guardian-swoop';
import {magicSlap} from './magic-slap';
import {suddenStrike} from './sudden-strike';
import {swoop} from './swoop';

/** Все шаблоны категории «abilities». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const abilityTemplates: AbilityTemplateInput[] = [
  bulwark,
  cleave,
  counterattack,
  dash,
  fireball,
  groundSlam,
  guardianSwoop,
  magicSlap,
  suddenStrike,
  swoop,
];
