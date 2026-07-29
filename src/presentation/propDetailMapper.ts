/**
 * Маппер: PropEntity (Simulation) → PropPopoverViewModel (UI).
 *
 * Presentation читает шаблон пропа из Content Registry
 * и формирует готовый ViewModel для popover'а.
 */

import type {PropEntity} from '@simulation/types';
import {tryGetLocalizedProp} from '@content/registry';
import {resolvePropSprite} from '@utils/assetResolver';
import type {PropPopoverViewModel} from './types';
import type {Locale} from '@content/texts/lookup';

export function mapPropToPopover(prop: PropEntity, locale: Locale): PropPopoverViewModel {
  const template = tryGetLocalizedProp(prop.templateId, locale);

  return {
    name: template?.name ?? prop.displayName,
    sprite: resolvePropSprite(prop.templateId),
    flavorText: template?.flavorText ?? '',
    hp: prop.hp,
    maxHp: prop.maxHp,
    armor: prop.armor,
    propKind: prop.propKind,
  };
}
