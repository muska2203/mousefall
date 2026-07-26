/**
 * Обратно-совместимая точка входа для клавиатурной карты.
 *
 * Источник данных — `keyboardConfig.ts`. Новый код должен импортировать оттуда напрямую.
 */

export {
  ACTION_KEY_BINDINGS,
  DEFAULT_HOTBAR_SIZE,
  HOTBAR_INDEX_BY_KEY,
  HOTBAR_KEYS,
  HOTBAR_LABELS,
  INTERACTIVE_TAGS,
  KEY_MAP,
  matchesActionBinding,
  getHotbarIndexByKey,
} from './keyboardConfig';
