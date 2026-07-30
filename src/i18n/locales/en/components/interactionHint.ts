import type {ComponentsInteractionHintTranslations} from '@i18n/schema';

export const enInteractionHint = {
  pickup: 'Pick up',
  descend: 'Descend',
  ascend: 'Ascend',
  openDoor: 'Open door',
  closeDoor: 'Close door',
  usePoi: 'Use',
  unknown: 'Interact',
  keyF: 'F',
  keyTab: 'Tab',
} as const satisfies ComponentsInteractionHintTranslations;
