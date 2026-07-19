import type {CommonUiTranslations} from '@i18n/schema';

export const enCommonUi = {
  yes: 'Yes',
  no: 'No',
  close: 'Close',
  cancel: 'Cancel',
  unknownMode: 'Unknown mode: {{mode}}',
} as const satisfies CommonUiTranslations;
