import type {ComponentsHotbarTranslations} from '@i18n/schema';

export const enHotbar = {
  emptySlotAria: 'Hot slot {{index}} (empty)',
  occupiedSlotAria: 'Hot slot {{index}}',
  toolbarAria: 'Quick access toolbar',
  skillTooltipApCost: 'AP: {{ap}}',
  skillTooltipCooldown: 'Cooldown: {{current}} / {{max}} turns',
  skillTooltipCastTime: 'Cast time: {{turns}} turns',
  weaponSlotName: 'Basic attack',
  weaponSlotUnarmed: 'Unarmed',
  weaponSlotHint: 'Click to pick an attack target',
} as const satisfies ComponentsHotbarTranslations;
