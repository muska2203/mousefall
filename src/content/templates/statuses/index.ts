import type {StatusTemplateInput} from '../../schemas';
import {bleeding} from './bleeding';
import {bulwark} from './bulwark';
import {burning} from './burning';
import {counterattack} from './counterattack';
import {dazed} from './dazed';
import {frozen} from './frozen';
import {oiled} from './oiled';
import {poisoned} from './poisoned';
import {regenerating} from './regenerating';
import {rooted} from './rooted';
import {silenced} from './silenced';
import {stunned} from './stunned';
import {wet} from './wet';

/** Все шаблоны категории «statuses». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const statusTemplates: StatusTemplateInput[] = [
  bleeding,
  bulwark,
  burning,
  counterattack,
  dazed,
  frozen,
  oiled,
  poisoned,
  regenerating,
  rooted,
  silenced,
  stunned,
  wet,
];
