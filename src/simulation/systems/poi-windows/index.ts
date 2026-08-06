/**
 * Реестр механик окон poi.
 *
 * Ключ — вид окна (`kind` из дескриптора `window` шаблона poi).
 * Новый вид окна = новый вариант в `PoiWindowSchema` (content) +
 * механика, зарегистрированная здесь.
 */

import type {PoiWindowKind} from '@content/schemas';
import type {PoiWindowMechanic} from './types';
import {relicChoiceMechanic} from './relic-choice-mechanic';

export const POI_WINDOW_MECHANICS: Record<PoiWindowKind, PoiWindowMechanic> = {
  relic_choice: relicChoiceMechanic,
};
