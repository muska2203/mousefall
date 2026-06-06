/**
 * Маппер: StairsEntity (Simulation) → StairsPopoverViewModel (UI).
 *
 * Presentation читает шаблон лестницы из Content Registry
 * и формирует готовый ViewModel для popover'а.
 */

import type { StairsEntity } from '@simulation/types';
import { tryGetLocalizedStairs } from '@content/registry';
import { resolveStairsSprite } from '@utils/assetResolver';
import type { StairsPopoverViewModel } from './types';
import type { Locale } from '@content/texts/lookup';

export function mapStairsToPopover(stairs: StairsEntity, locale: Locale): StairsPopoverViewModel {
  const currentLocale = locale;
  const template = tryGetLocalizedStairs(stairs.templateId, currentLocale);

  return {
    name: template?.name ?? stairs.displayName,
    sprite: resolveStairsSprite(stairs.templateId),
    flavorText: template?.flavorText ?? '',
  };
}
