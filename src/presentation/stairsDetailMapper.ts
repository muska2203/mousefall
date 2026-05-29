/**
 * Маппер: StairsEntity (Simulation) → StairsPopoverViewModel (UI).
 *
 * Presentation читает шаблон лестницы из Content Registry
 * и формирует готовый ViewModel для popover'а.
 */

import type { StairsEntity } from '@simulation/types';
import { tryGetStairs } from '@content/registry';
import { resolveStairsSprite } from '@utils/assetResolver';
import type { StairsPopoverViewModel } from './types';

export function mapStairsToPopover(stairs: StairsEntity): StairsPopoverViewModel {
  const template = tryGetStairs(stairs.templateId);

  return {
    name: template?.name ?? stairs.displayName,
    sprite: resolveStairsSprite(stairs.templateId),
    flavorText: template?.flavorText ?? '',
  };
}
