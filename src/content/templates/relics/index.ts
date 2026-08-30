import type {RelicTemplateInput} from '../../schemas';
import {relicBloodPact} from './relic-blood-pact';

/**
 * Все шаблоны категории «relics». Новый шаблон добавляется сюда импортом и строкой в массиве.
 *
 * Реликвии первой итерации архивированы в `templates/legacy/relics/`
 * (2026-09-01, план `docs/plans/legacy-content-archival.md`). Реликвия
 * relic_blood_pact возвращена в активный реестр для кровавой ветки билдов
 * (этап 0 плана `docs/plans/bleed-builds-implementation.md`).
 */
export const relicTemplates: RelicTemplateInput[] = [
  relicBloodPact,
];
