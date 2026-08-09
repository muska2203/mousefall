import {abilities} from './abilities';
import {doors, pois, props, stairs, traps} from './environment';
import {entities} from './entities';
import {items} from './items';
import {modifiers} from './modifiers';
import {players} from './players';
import {relics} from './relics';
import {rules} from './rules';
import {statuses} from './statuses';
import {tags} from './tags';
import {terrain} from './terrain';
import {tileEffects} from './tile-effects';
import {tileEffectStatuses} from './tile-effect-statuses';
import type {ContentTexts} from '../types';

export const ruContentTexts: ContentTexts = {
  abilities,
  doors,
  entities,
  items,
  modifiers,
  players,
  pois,
  props,
  relics,
  rules,
  statuses,
  terrain,
  tileEffects,
  tileEffectStatuses,
  stairs,
  tags,
  traps,
};
