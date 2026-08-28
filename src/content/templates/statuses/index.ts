import type {StatusTemplateInput} from '../../schemas';
import {bleeding} from './bleeding';
import {braced} from './braced';
import {bulwark} from './bulwark';
import {burning} from './burning';
import {counterattack} from './counterattack';
import {dazed} from './dazed';
import {empowered} from './empowered';
import {frozen} from './frozen';
import {oiled} from './oiled';
import {poisoned} from './poisoned';
import {regenerating} from './regenerating';
import {rooted} from './rooted';
import {silenced} from './silenced';
import {stunned} from './stunned';
import {swift} from './swift';
import {wet} from './wet';

/** Все шаблоны категории «statuses». Новый шаблон добавляется сюда импортом и строкой в массиве. */
export const statusTemplates: StatusTemplateInput[] = [
  bleeding,
  braced,
  bulwark,
  burning,
  counterattack,
  dazed,
  empowered,
  frozen,
  oiled,
  poisoned,
  regenerating,
  rooted,
  silenced,
  stunned,
  swift,
  wet,
];
