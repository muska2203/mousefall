import type {SystemActionValidationsTranslations} from '@i18n/schema';

export const enActionValidations = {
  itemNotFound: 'Item not found in inventory',
  itemCannotEquip: 'Item cannot be equipped',
  onlyPlayerCanTransition: 'Only the player can transition between floors',
  cannotCloseDoorFromInside: 'Cannot close the door while standing on its tile',
  slotEmpty: 'Slot is empty',
  itemCannotUse: 'Item cannot be used',
  itemEffectNotSupported: 'Item effect "{{effect}}" is not supported',
} as const satisfies SystemActionValidationsTranslations;
