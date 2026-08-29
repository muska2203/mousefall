import type {RelicTemplateInput} from '../../schemas';

/**
 * Все шаблоны категории «relics». Новый шаблон добавляется сюда импортом и строкой в массиве.
 *
 * Реликвии первой итерации архивированы в `templates/legacy/relics/`
 * (2026-09-01, план `docs/plans/legacy-content-archival.md`): ждут переработки
 * под билды. Пока категория пуста — окно `relic_choice` при пустом пуле просто
 * не открывается (`relic-choice-mechanic.ts`).
 */
export const relicTemplates: RelicTemplateInput[] = [];
