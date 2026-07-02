import type { ComponentsInteractionHintTranslations } from '@i18n/schema';

export const ruInteractionHint = {
  pickup: 'Поднять',
  descend: 'Спуститься',
  ascend: 'Подняться',
  openDoor: 'Открыть дверь',
  closeDoor: 'Закрыть дверь',
  unknown: 'Взаимодействовать',
  keyF: 'F',
  keyTab: 'Tab',
} as const satisfies ComponentsInteractionHintTranslations;
