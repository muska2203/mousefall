import type {ModifierTemplateInput} from '../../schemas';

/**
 * Все шаблоны категории «modifiers». Новый шаблон добавляется сюда импортом и строкой в массиве.
 *
 * Модификаторы первой итерации архивированы в `templates/legacy/modifiers/`
 * (2026-09-01, план `docs/plans/legacy-content-archival.md`): правила и
 * модификаторы предметов будут переработаны вместе с билдами. Пока категория пуста —
 * ролл аффиксов к пустому пулу устойчив (`item-affix-roll.ts`), ссылки в шаблонах отсутствуют.
 */
export const modifierTemplates: ModifierTemplateInput[] = [];
