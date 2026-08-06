/**
 * Маппер: RelicTemplate (Content) → список эффектов для UI (Presentation).
 *
 * Каждый эффект реликвии — отдельный пункт «имя + краткое описание»:
 * - ruleIds → тексты правил из `texts/{ru,en}/rules.ts` (могут содержать тег-ссылки);
 * - statModifiers → локализованное имя характеристики (i18n `system.statNames`)
 *   и форматированное значение («+N» / «−N» для add, «×N» для multiply).
 *
 * Порядок: сначала правила, затем модификаторы характеристик.
 */

import type {RelicTemplate} from '@content/schemas';
import type {Locale} from '@content/texts/lookup';
import {getContentText} from '@content/texts/lookup';
import type {RelicEffectViewModel} from './types';
import {t} from '@i18n/t';

/** Форматирует значение модификатора характеристики: add → «+N»/«−N», multiply → «×N». */
function formatModifierValue(op: 'add' | 'multiply', value: number): string {
  if (op === 'multiply') {
    return `×${value}`;
  }
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

/** Собирает список эффектов реликвии (правила + модификаторы характеристик) для ViewModel. */
export function buildRelicEffects(template: RelicTemplate, locale: Locale): RelicEffectViewModel[] {
  const effects: RelicEffectViewModel[] = [];

  for (const ruleId of template.ruleIds) {
    const text = getContentText('rules', ruleId, locale);
    effects.push({
      key: ruleId,
      name: text.name,
      description: text.description ?? '',
    });
  }

  for (const modifier of template.statModifiers) {
    effects.push({
      key: `stat_${modifier.stat}`,
      name: t(`system.statNames.${modifier.stat}`),
      description: formatModifierValue(modifier.op, modifier.value),
    });
  }

  return effects;
}
