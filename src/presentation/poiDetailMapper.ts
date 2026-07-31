/**
 * Маппер: PointOfInterestEntity (Simulation) → PoiPopoverViewModel (UI).
 *
 * Presentation читает шаблон точки интереса из Content Registry
 * и формирует готовый ViewModel для popover'а.
 */

import type {PointOfInterestEntity} from '@simulation/types';
import {tryGetLocalizedPoi} from '@content/registry';
import {resolvePoiSprite} from '@utils/assetResolver';
import {resolveEntitySprite} from './objectSpriteResolver';
import type {PoiPopoverViewModel} from './types';
import type {Locale} from '@content/texts/lookup';

export function mapPoiToPopover(poi: PointOfInterestEntity, locale: Locale): PoiPopoverViewModel {
  const template = tryGetLocalizedPoi(poi.templateId, locale);

  return {
    name: template?.name ?? poi.displayName,
    sprite: resolveEntitySprite(poi) ?? resolvePoiSprite(poi.templateId),
    flavorText: template?.flavorText ?? '',
    charges: poi.charges,
  };
}
