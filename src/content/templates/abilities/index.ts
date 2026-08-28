import type {AbilityTemplateInput} from '../../schemas';
import {battleRage} from './battle-rage';
import {braceStance} from './brace-stance';
import {bulwark} from './bulwark';
import {cleave} from './cleave';
import {counterattack} from './counterattack';
import {dash} from './dash';
import {fireball} from './fireball';
import {groundSlam} from './ground-slam';
import {guardianSwoop} from './guardian-swoop';
import {magicSlap} from './magic-slap';
import {search} from './search';
import {stoneThrow} from './stone-throw';
import {suddenStrike} from './sudden-strike';
import {swiftness} from './swiftness';
import {swoop} from './swoop';

/** Все шаблоны категории «abilities». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const abilityTemplates: AbilityTemplateInput[] = [
  battleRage,
  braceStance,
  bulwark,
  cleave,
  counterattack,
  dash,
  fireball,
  groundSlam,
  guardianSwoop,
  magicSlap,
  search,
  stoneThrow,
  suddenStrike,
  swiftness,
  swoop,
];
