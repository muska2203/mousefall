/**
 * Маппер: TrapEntity (Simulation) → TrapPopoverViewModel (UI).
 *
 * Presentation читает шаблон ловушки из Content Registry
 * и формирует готовый ViewModel для popover'а.
 * Скрытые ловушки сюда не попадают (фильтрация в buildFieldObjectPopover).
 */

import type {TrapEntity} from '@simulation/types';
import {tryGetLocalizedTrap} from '@content/registry';
import {resolveTrapSprite} from '@utils/assetResolver';
import type {TrapPopoverViewModel} from './types';
import type {Locale} from '@content/texts/lookup';

export function mapTrapToPopover(trap: TrapEntity, locale: Locale): TrapPopoverViewModel {
  const template = tryGetLocalizedTrap(trap.templateId, locale);

  return {
    name: template?.name ?? trap.displayName,
    sprite: resolveTrapSprite(trap.templateId),
    flavorText: template?.flavorText ?? '',
  };
}
