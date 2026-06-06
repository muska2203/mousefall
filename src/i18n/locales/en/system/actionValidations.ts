import type { SystemActionValidationsTranslations } from '@i18n/schema';

export const enActionValidations = {
  itemNotFound: 'Item not found in inventory',
  itemCannotEquip: 'Item cannot be equipped',
  onlyPlayerCanDescend: 'Only the player can descend',
  noDescentHere: 'No descent here',
  bottomFloorReached: 'Bottom floor reached',
  onlyPlayerCanAscend: 'Only the player can ascend',
  noAscentHere: 'No ascent here',
  alreadyOnSurface: 'You are already on the surface',
  slotEmpty: 'Slot is empty',
  itemCannotUse: 'Item cannot be used',
  itemEffectNotSupported: 'Item effect "{{effect}}" is not supported',
} as const satisfies SystemActionValidationsTranslations;
