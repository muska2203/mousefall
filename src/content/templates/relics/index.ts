import type {RelicTemplateInput} from '../../schemas';
import {relicAcidBlood} from './relic-acid-blood';
import {relicBloodPact} from './relic-blood-pact';
import {relicOpportunist} from './relic-opportunist';
import {relicPlagueBearer} from './relic-plague-bearer';
import {relicSalamanderHeart} from './relic-salamander-heart';
import {relicScavenger} from './relic-scavenger';
import {relicThunderhead} from './relic-thunderhead';
import {relicVenomGland} from './relic-venom-gland';

/**
 * Все шаблоны категории «relics». Новый шаблон добавляется сюда импортом и строкой в массиве.
 * Стартовый пул (roadmap 0.6): 8 нестакаемых реликвий, у каждой — плюс и минус.
 */
export const relicTemplates: RelicTemplateInput[] = [
  relicSalamanderHeart,
  relicVenomGland,
  relicAcidBlood,
  relicPlagueBearer,
  relicThunderhead,
  relicOpportunist,
  relicBloodPact,
  relicScavenger,
];
