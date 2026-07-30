import {abilities} from './abilities';
import {doors, pois, props, stairs} from './environment';
import {entities} from './entities';
import {items} from './items';
import {players} from './players';
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
  players,
  pois,
  props,
  rules,
  statuses,
  terrain,
  tileEffects,
  tileEffectStatuses,
  stairs,
  tags,
};
