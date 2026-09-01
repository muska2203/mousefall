import type {RelicTemplateInput} from '../../schemas';
import {relicBloodPact} from './relic-blood-pact';
import {relicBloodLeech} from './relic-blood-leech';
import {relicBloodEcho} from './relic-blood-echo';
import {relicBloodReaper} from './relic-blood-reaper';
import {relicBloodFuel} from './relic-blood-fuel';
import {relicBloodRupture} from './relic-blood-rupture';

/**
 * Все шаблоны категории «relics». Новый шаблон добавляется сюда импортом и строкой в массиве.
 *
 * Реликвии первой итерации архивированы в `templates/legacy/relics/`
 * (2026-09-01, план `docs/plans/legacy-content-archival.md`). Реликвия
 * relic_blood_pact возвращена в активный реестр для кровавой ветки билдов
 * (этап 0 плана `docs/plans/bleed-builds-implementation.md`).
 * Пять реликвий кровавой ветки (relic_blood_*) добавлены этапом 3 того же плана.
 */
export const relicTemplates: RelicTemplateInput[] = [
  relicBloodPact,
  relicBloodLeech,
  relicBloodEcho,
  relicBloodReaper,
  relicBloodFuel,
  relicBloodRupture,
];
