import type { ComponentsHotSlotTranslations } from '@i18n/schema';

export const enHotSlot = {
  emptySlotAria: 'Hot slot {{index}} (empty)',
  occupiedSlotAria: 'Hot slot {{index}}',
} as const satisfies ComponentsHotSlotTranslations;
