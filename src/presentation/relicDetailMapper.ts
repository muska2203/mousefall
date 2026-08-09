/**
 * Маппер: RelicTemplate (Content) → список эффектов для UI (Presentation).
 *
 * Каждый эффект реликвии — одна строка с полярностью (positive/negative):
 * - ruleIds → краткое описание правила из `texts/{ru,en}/rules.ts` (может содержать тег-ссылки),
 *   полярность — из опционального поля `polarity` правила (по умолчанию positive);
 * - statModifiers → строка вида «Имя: +N» — локализованное имя характеристики
 *   (i18n `system.statNames`) и форматированное значение («+N» / «−N» для add, «×N» для multiply),
 *   полярность выводится из значения (add < 0 или multiply < 1 → negative).
 *
 * Порядок: сначала правила, затем модификаторы характеристик.
 */

import type {RelicTemplate} from '@content/schemas';
import type {Locale} from '@content/texts/lookup';
import {getContentText} from '@content/texts/lookup';
import {tryGetContentRule} from '@simulation/content-rules/registry';
import type {RelicEffectViewModel} from './types';
import {t} from '@i18n/t';

/** Форматирует значение модификатора характеристики: add → «+N»/«−N», multiply → «×N». */
export function formatModifierValue(op: 'add' | 'multiply', value: number): string {
  if (op === 'multiply') {
    return `×${value}`;
  }
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

/** Выводит полярность модификатора характеристики из значения: уменьшение стата → negative. */
function statModifierPolarity(op: 'add' | 'multiply', value: number): 'positive' | 'negative' {
  return (op === 'multiply' ? value < 1 : value < 0) ? 'negative' : 'positive';
}

/** Собирает список эффектов реликвии (правила + модификаторы характеристик) для ViewModel. */
export function buildRelicEffects(template: RelicTemplate, locale: Locale): RelicEffectViewModel[] {
  const effects: RelicEffectViewModel[] = [];

  for (const ruleId of template.ruleIds) {
    const text = getContentText('rules', ruleId, locale);
    effects.push({
      key: ruleId,
      text: text.description ?? '',
      polarity: tryGetContentRule(ruleId)?.polarity ?? 'positive',
    });
  }

  for (const modifier of template.statModifiers) {
    const statName = t(`system.statNames.${modifier.stat}`);
    effects.push({
      key: `stat_${modifier.stat}`,
      text: `${statName}: ${formatModifierValue(modifier.op, modifier.value)}`,
      polarity: statModifierPolarity(modifier.op, modifier.value),
    });
  }

  return effects;
}
