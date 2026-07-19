/**
 * Маппер: DoorEntity (Simulation) → DoorPopoverViewModel (UI).
 *
 * Presentation читает шаблон двери из Content Registry
 * и формирует готовый ViewModel для popover'а.
 */

import type {DoorEntity} from '@simulation/types';
import {tryGetLocalizedDoor} from '@content/registry';
import {resolveDoorSprite} from '@utils/assetResolver';
import type {DoorPopoverViewModel} from './types';
import type {Locale} from '@content/texts/lookup';

export function mapDoorToPopover(door: DoorEntity, locale: Locale): DoorPopoverViewModel {
  const template = tryGetLocalizedDoor(door.templateId, locale);

  return {
    name: template?.name ?? door.displayName,
    sprite: resolveDoorSprite(door.templateId, door.isOpen, template?.openSpriteId),
    flavorText: template?.flavorText ?? '',
    hp: door.hp,
    maxHp: door.maxHp,
    armor: door.armor,
  };
}
